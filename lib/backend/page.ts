import NodeURL from 'url';
import EventEmitter from 'events';
import WebSocket from 'ws';
import { Metadata, WebSocketMessage, DomainName, TargetToClientEventPayloadTypes, SocketStatus } from 'typings/common';

import { domains } from './domains';
import { middlewares } from './middleware';
import logger, { WrappedLogger } from '../logger';
import { getDomain, getRequestIp } from '../utils';
import { WrappedRequest } from './utils/request';
import { DEFAULT_HOST, DEFAULT_PORT } from '../index';

const SERVER_DOMAINS: DomainName[] = ['Network', 'Log', 'Webdriver'];
const CONNECTION_TIMEOUT = 5000;

type EventPayloadTypes = {
  incoming: {
    method: string;
    domain: DomainName;
    msg: WebSocketMessage;
  };
  disconnect: string;
  domainEnabled: DomainName;
};

/**
 * Page model
 * ==========
 *
 * Manages connection between: Device (TV) <--> Devtools backend <--> Devtools frontend. Each
 * page can be identified by an UUID where ids between device (TV) and devtools backend might
 * change over time due to page reloads.
 *
 * Device (TV) <--> Devtools backend connection:
 * Handled by a socket.io connection (for compatibility issues)
 *
 * Devtools backend <--> Devtools frontend
 * Handles by a standard socket connection (WS).
 */
export default class Page extends EventEmitter {
  public clientIp: string;
  public requestList: WrappedRequest[] = [];
  public log: WrappedLogger;
  public isConnectedToClient = false;
  private domains: DomainName[] = [];
  private supportedDomains: DomainName[];
  private messageBuffer: WebSocketMessage[] = [];
  public clientSocketServer: WebSocket.Server;
  private clientSocket: WebSocket;
  public isConnectedToTarget: boolean;
  private targetConnectedTime: number;
  private targetDisconnectTimeout: NodeJS.Timer;
  private pingTimer: NodeJS.Timer;
  public on: <T extends keyof EventPayloadTypes>(event: T, listener: (result: EventPayloadTypes[T]) => void) => this;
  public emit: <T extends keyof EventPayloadTypes>(event: T, params: EventPayloadTypes[T]) => boolean;
  public deviceIp: string;
  public targetSocket: SocketIO.Socket;
  public uuid: string;
  public hostname: string;
  public url: NodeURL.UrlWithStringQuery;
  public title: string;
  public description: string;
  public metadata: Metadata;
  public deviceId: string;
  public frameId: string;

  constructor(info: TargetToClientEventPayloadTypes['registerPage'], socket: SocketIO.Socket) {
    super();
    this.log = logger('Page');

    this.clientSocketServer = new WebSocket.Server({
      perMessageDeflate: false,
      noServer: true,
    });
    this.connectTarget(info, socket);
  }

  /**
   * Connect to device (TV)
   */
  connectTarget(info: TargetToClientEventPayloadTypes['registerPage'], socket: SocketIO.Socket): void {
    this.log.info(`Connected to device with page id ${this.uuid}`);
    this.updateNewSocket(socket);
    this.assignInformation(info);
    this.targetSocket.on('result', this.send);
    this.targetSocket.on('disconnect', this.disconnectTarget);
    this.targetSocket.on('debug', msg => this.log.info(msg));
    this.targetSocket.on('getStatus', this.getStatus);
    domains.Network.addListenerOnPageTargetSocket(this);
    this.isConnectedToTarget = true;
    this.targetConnectedTime = Date.now();
    this.enable(this.supportedDomains.concat(SERVER_DOMAINS));

    /**
     * clear timeout when connection got disconnected
     */
    clearTimeout(this.targetDisconnectTimeout);

    this.targetSocket.emit('pageRegistered');
  }

  /**
   * Disconnect from device (TV)
   */
  disconnectTarget = (reason: string): void => {
    this.log.info(`Disconnected from device with page id ${this.uuid} because of ${reason}`);
    this.isConnectedToTarget = false;

    /**
     * clear execution context
     */
    this.send({
      method: 'Runtime.executionContextDestroyed',
      params: { executionContextId: 1 },
    });
    this.send({ method: 'Runtime.executionContextsCleared', params: {} });

    /**
     * disconnect from devtools frontend if connection was lost for more than the timeout threshold
     */
    this.targetDisconnectTimeout = setTimeout(() => {
      if (this.isConnectedToTarget) {
        // page reconnected (e.g. on page load)
        return;
      }

      this.log.info(`Removing page with uuid ${this.uuid}`);
      this.send({
        method: 'Inspector.detached',
        params: { reason: 'Render process gone.' },
      });
      this.send({
        method: 'Inspector.detached',
        params: { reason: 'target_close' },
      });
      this.isConnectedToTarget = false;

      /**
       * remove all listeners
       */
      this.targetSocket.removeAllListeners();
      delete this.targetSocket;

      return this.emit('disconnect', this.uuid);
    }, CONNECTION_TIMEOUT);
  }

  /**
   * Connect to devtools frontend
   */
  connectClient(clientIp: string, ws: WebSocket): void {
    this.disconnectClient();
    this.log.info(
      `Connected to devtools-frontend page ${this.uuid}`,
      clientIp,
      ws.readyState
    );
    // NOTE in `ws` library, this function is called after `open` event emits in `ws`
    this.isConnectedToClient = true;

    this.clientIp = clientIp;
    this.clientSocket = ws;
    this.clientSocket.on('close', this.disconnectClient.bind(this));
    this.clientSocket.on('error', error => {
      this.log.debug(`connect client error ${this.uuid}`, error);
    });
    this.clientSocket.on('message', this.handleIncoming);

    // If there is no data transfered, the connection is disconnected in about 2mins
    // So we send empty information to Debug Client in order to keep it alive
    clearInterval(this.pingTimer);
    this.pingTimer = setInterval(() => {
      this.log.debug(`connect client timer ${this.uuid}`, this.clientSocket.readyState);
      if (!this.clientSocket || this.clientSocket.readyState !== WebSocket.OPEN) {
        clearInterval(this.pingTimer);
        return;
      }
      // Send a no side-effect function call to maintain the connection
      this.send({
        method: 'HeadlessExperimental.needsBeginFramesChanged',
        params: { needsBeginFrames: false },
      });
    }, 30 * 1000);

    /**
     * send events that were missed by devtools-frontend
     */
    this.flushMsgBuffer();
  }

  /**
   * Disconnect from devtools frontend
   */
  disconnectClient(): void {
    if (!this.clientSocket) {
      return;
    }
    this.log.info(`Disconnect from devtools-frontend page ${this.uuid}`);
    this.isConnectedToClient = false;
    this.clientSocket.terminate();
    clearInterval(this.pingTimer);
    delete this.clientIp;
    delete this.clientSocket;
  }

  /**
   * enable domain for page
   *
   * @param {String|String[]} domain  domain(s) to enable
   */
  enable(domain: DomainName | DomainName[]): void {
    if (Array.isArray(domain)) {
      return domain.forEach(domain => this.enable(domain));
    }

    this.afterDomainEnabled(domain);

    if (this.domains.includes(domain)) {
      return this.log.info(
        `Domain "${domain}" already enabled for page ${this.uuid}`
      );
    }

    this.log.info(`Enable domain ${domain} for page ${this.uuid}`);
    this.domains.push(domain);
  }

  /**
   * disable domain for page
   */
  disable(domain: DomainName): void {
    this.log.info(`Disable domain ${domain} for page ${this.uuid}`);
    const pos = this.domains.indexOf(domain);
    this.domains.splice(pos, pos + 1);
  }

  /**
   * check if domain is currently supported/enabled
   * Usage:
   *  - isDomainSupported({ method: 'Network.loadingFinished', params: { ... }})
   *  - isDomainSupported('Network')
   *
   * @param   [Object|String] msg  either:
   *                                 - a WS message like first example above or
   *                                 - string if you want to specify the domain directly
   * @returns [Boolean]            true if the specified domain is supported/enabled
   */
  isDomainSupported(msg: DomainName | WebSocketMessage): boolean {
    if (typeof msg === 'string') {
      return this.domains.includes(msg);
    }

    const method = msg.method || '';
    const splitPoint = method.indexOf('.');
    return this.domains.includes(method.slice(0, splitPoint) as DomainName);
  }

  /**
   * Handle incoming debugger request.
   * Incoming can be either (but mostly) messages from the devtools app directly
   * or from other parts of the app (e.g. proxy)
   *
   * @param {Object|String} payload  message with command and params
   */
  handleIncoming = (payload: WebSocket.Data): void => {
    this.log.info(`Handle incoming for page ${this.uuid}`, payload);
    const msg: WebSocketMessage = typeof payload === 'string' ? JSON.parse(payload) : payload;
    const splitPoint = msg.method.indexOf('.');
    const domain = msg.method.slice(0, splitPoint) as DomainName;
    const method = msg.method.slice(splitPoint + 1);

    /**
     * enable domain agent
     */
    if (method === 'enable' && this.isDomainSupported(domain)) {
      this.enable(domain);
      return this.send({ id: msg.id, params: {} });
    }

    /**
     * disable domain agent
     */
    if (method === 'disable') {
      this.disable(domain);
      return this.send({ id: msg.id, params: {} });
    }

    /**
     * don't propagate domains that are not supported or disabled
     */
    if (!this.isDomainSupported(msg)) {
      return;
    }

    this.emit('incoming', { method, domain, msg });
  }

  flushMsgBuffer(): void {
    // TODO: we can remove clientSocket check later
    if (this.clientSocket) {
      this.messageBuffer.forEach(bufferMsg => this.send(bufferMsg, false));
    }
    this.messageBuffer = [];
  }

  /**
   * emits payload to devtools frontend
   */
  send = (msg: WebSocketMessage, flushBuffer = true): void => {
    if (!this.clientSocket) {
      this.messageBuffer.push(msg);
      return;
    }

    /**
     * check if buffer contains unsend messages
     */
    if (flushBuffer && this.messageBuffer.length) {
      this.flushMsgBuffer();
      return process.nextTick(() => this.send(msg, false));
    }

    /**
     * check for server side domain handlers
     */
    if (middlewares[msg._domain] && middlewares[msg._domain][msg._method]) {
      const result = middlewares[msg._domain][msg._method].call(
        this,
        msg.result,
        this.requestList
      );
      return this.send({ id: msg.id, result });
    }

    delete msg._domain;
    delete msg._method;

    const msgString = JSON.stringify(msg);
    this.log.info(`Outgoing debugger message: ${msgString.slice(0, 1000)}`);

    /**
     * broadcast to clients that have open socket connection
     */
    if (this.clientSocket.readyState !== WebSocket.OPEN) {
      return;
    }

    return this.clientSocket.send(msgString);
  }

  /**
   * trigger event to happen on device
   */
  trigger(domain: DomainName, params = {}): void {
    if (!this.targetSocket) {
      return this.log.error('no socket found to trigger event');
    }

    this.targetSocket.emit(domain, params);
  }

  /**
   * trigger page load events (set frameId to 1.0 if none given and proxy is not active)
   */
  frameStartedLoading(targetUrl?: string, frameId = '1.0'): void {
    if (!targetUrl && !this.url) {
      return;
    }

    domains.Page.frameStartedLoading(this, {
      'set-cookie': [`frameId=${frameId}`],
    }); // emulate page load
    this.url = NodeURL.parse(this.url as unknown as string || targetUrl); // update url
  }

  /**
   * Fired once navigation of the frame has completed. Frame is now associated with the new loader.
   */
  frameNavigated(targetUrl: string, frameId: string): void {
    const id = frameId.split('.')[0];
    const parsedUrl = NodeURL.parse(targetUrl || this.url as unknown as string);
    domains.Page.frameNavigated.call(
      this,
      id,
      `${parsedUrl.protocol}//${parsedUrl.host}`,
      parsedUrl.path
    );
  }

  get targetConnectionDuration(): number {
    if (!this.isConnectedToTarget) {
      return 0;
    }

    return Date.now() - this.targetConnectedTime;
  }

  destroy(): void {
    if (this.clientSocket) {
      this.clientSocket.terminate();
    }
    clearInterval(this.pingTimer);
  }

  updateNewSocket(socket: SocketIO.Socket): void {
    if (socket === this.targetSocket) {
      return;
    }
    if (this.targetSocket) {
      this.targetSocket.removeAllListeners();
      this.targetSocket.disconnect(/* closeConnection */ true);
    }
    this.targetSocket = socket;
  }

  getStatus = (callback: (status: SocketStatus) => void): void => {
    const { isConnectedToClient, isConnectedToTarget, clientIp, targetConnectionDuration } = this;
    callback({
      isConnectedToClient,
      isConnectedToTarget,
      clientIp,
      targetConnectionDuration,
    });
  }

  private assignInformation({
    uuid,
    hostname,
    url,
    title,
    description,
    metadata,
    deviceId,
    supportedDomains,
    frameId,
  }: TargetToClientEventPayloadTypes['registerPage']): void {
    this.uuid = uuid;
    this.hostname = hostname || this.hostname || `${DEFAULT_HOST}:${DEFAULT_PORT}`;
    /**
     * only update url if domain has changed and not e.g. host
     */
    const newUrl = NodeURL.parse(url);
    if (!this.url) {
      this.url = newUrl;
    } else if (getDomain(this.url) !== getDomain(newUrl)) {
      this.url = newUrl;
    }
    this.title = title;
    this.description = description;
    this.metadata = metadata;
    this.deviceIp = getRequestIp(this.targetSocket.request);
    this.deviceId = deviceId;
    this.supportedDomains = supportedDomains;
    this.frameId = frameId;
  }

  private afterDomainEnabled(domain: DomainName): void {
    /**
     * trigger events in case the dev tool was refreshed
     * (these are normally triggered on this load but in case of
     * a refresh we can emit them here)
     */
    if (domain.toLowerCase() === 'debugger') {
      this.trigger(domain, { method: 'scriptParsed' });
    }

    if (domain.toLowerCase() === 'runtime') {
      this.trigger(domain, { method: 'executionContextCreated' });

      /**
       * also send target created event as they usually happen at the same time
       */
      domains.Target.targetCreated(this);
    }
  }
}
