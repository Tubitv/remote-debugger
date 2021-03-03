import io from 'socket.io-client';
import Cookie from 'js-cookie';
import { ExecuteCommandPayloadTypes, DomainName, SocketStatus, TargetToClientEventPayloadTypes } from 'typings/common';

import domains from './domains';
import { CSSStore } from './models/CSSStore';
import { setNodeIds } from './utils/dom';
import { getTitle, getDescription } from './utils/common';
import { RemoteDebuggerLauncher } from './launcher.bundle';
import { DebugBridge } from './utils/DebugBridge';
import { TIMEOUT } from '../constants';

const SUPPORTED_DOMAINS: DomainName[] = Object.keys(domains) as DomainName[];
const ASYNC_METHODS: {
  [key in DomainName]?: {
    [name: string]: true;
  }
} = {
  Runtime: {
    compileScript: true,
    evaluate: true,
  },
};

export type DebuggerStatus = {
  socketId: string;
  uuid: string;
  serverConnected: boolean;
} & Partial<SocketStatus>;

/**
 * Pure implementation of the Chrome Remote Debugger Protocol (tip-of-tree) in JavaScript
 */
export class RemoteDebugger {
  // TODO: remove this any later
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  domains: { [id: string]: any };
  requestId: string;
  executionContextId: number;
  frameId: string;
  socket: SocketIOClient.Socket;
  readyStateComplete: boolean;
  cssStore: CSSStore;
  originalConsole?: Console;
  destroyed: boolean;
  debugBridge: DebugBridge;
  constructor(private launcher: RemoteDebuggerLauncher, public uuid: string, public origin: string) {
    this.domains = {};
    this.requestId = Cookie.get('requestId') || '1.1'; // set to 1.1 in case Network domain is disabled
    this.executionContextId = parseInt(this.requestId.split('.')[0]);
    this.frameId = Cookie.get('frameId') || '1.0'; // set to 1.0 in case Network domain is disabled
    this.socket = io(`${this.origin}`);
    this.readyStateComplete = false;
    this.debugBridge = new DebugBridge();
    this.bindSocketEvents();
    this.overrideGlobalVariables();
    this.cssStore = new CSSStore(this.requestId);

    /**
     * trigger executionContextCreated event
     */
    if (document.readyState === 'complete') {
      this.loadHandler();
    } else {
      document.addEventListener('readystatechange', () => {
        if (document.readyState === 'complete') {
          this.loadHandler();
        }
      });
    }
  }

  bindSocketEvents(): void {
    this.socket.on('connect', this.onConnect);
    this.socket.on('disconnect', this.onDisconnect);
    this.socket.on('reconnect', this.onReconnect);
    this.socket.on('connect_timeout', this.onConnectTimeout);
    this.socket.on('connect_error', this.onConnectError);
    this.socket.on('reconnecting', () => this.launcher.emitLifecycleEvent('server_reconnecting'));
    this.socket.on('reconnect_failed', () => this.launcher.emitLifecycleEvent('server_reconnect_failed'));
    this.socket.on('pageRegistered', () => this.launcher.emitLifecycleEvent('server_page_registered'));
    for (const [name, domain] of Object.entries(domains)) {
      this.socket.on(name as DomainName, (args: unknown): SocketIOClient.Socket => this.dispatchEvent(domain, args));
      this.domains[name] = domain;
    }
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.unloadHandler();
    if (this.debugBridge) {
      this.debugBridge.destroy();
      this.debugBridge = null;
    }
    this.cssStore = null;
    // @ts-ignore
    window.console = this.originalConsole;
    window.removeEventListener('error', console.error);
    this.socket.removeAllListeners();
    this.socket.close();
    this.destroyed = true;
  }

  /**
   * @deprecated This API is deprecated, you can use the getDebuggerStatus instead
   */
  getStatus(): {
    id: string;
    connected: boolean;
    domains: string[];
    } {
    return {
      id: this.socket.id,
      connected: this.socket.connected,
      domains: Object.keys(this.domains),
    };
  }

  async getDebuggerStatus(): Promise<DebuggerStatus> {
    const localStatus = {
      socketId: this.socket.id,
      uuid: this.uuid,
      serverConnected: this.socket.connected,
    };
    if (this.socket.disconnected) {
      return localStatus;
    }
    const remoteStatus = await new Promise<SocketStatus>((resolve) => {
      let isTimeout = false;
      const fn = (data: SocketStatus): void => {
        if (isTimeout) {
          return;
        }
        resolve(data);
        /* eslint-disable-next-line @typescript-eslint/no-use-before-define */
        clearTimeout(timer);
      };
      this.emit('getStatus', fn);
      const timer = setTimeout(() => {
        isTimeout = true;
        resolve({ timeout: true });
      }, TIMEOUT);
    });
    return {
      ...localStatus,
      ...remoteStatus,
    };
  }

  overrideGlobalVariables(): void {
    window.addEventListener('error', console.error);
    /**
     * overwrite console object
     */
    this.originalConsole = window.console;
    // @ts-ignore
    window.console = domains.Runtime.overwriteConsole.call(
      this,
      window.console
    );
  }

  onConnect = (): void => {
    this.registerPage();
    this.launcher.emitLifecycleEvent('server_connect');
  }

  onDisconnect = (reason: string): void => {
    this.emit(
      'debug',
      'disconnect: ' +
        JSON.stringify({
          uuid: this.uuid,
          frameId: this.frameId,
          reason,
        })
    );
    this.launcher.emitLifecycleEvent('server_disconnect');
  }

  onReconnect = (attempt: number): void => {
    this.emit(
      'debug',
      'reconnect: ' +
        JSON.stringify({
          uuid: this.uuid,
          frameId: this.frameId,
          attempt,
        })
    );
    this.launcher.emitLifecycleEvent('server_reconnect');
  }

  onConnectError = (error: Error): void => {
    this.emit(
      'debug',
      'connect error' +
        JSON.stringify({
          uuid: this.uuid,
          frameId: this.frameId,
          error,
        })
    );
    this.launcher.emitLifecycleEvent('server_connect_error');
  }

  onConnectTimeout = (): void => {
    this.emit(
      'debug',
      'connect timeout' +
        JSON.stringify({
          uuid: this.uuid,
          frameId: this.frameId,
        })
    );
    this.launcher.emitLifecycleEvent('server_connect_timeout');
  }

  emit<EventName extends keyof TargetToClientEventPayloadTypes>(
    event: EventName,
    payload: TargetToClientEventPayloadTypes[EventName]
  ): SocketIOClient.Socket {
    return this.socket.emit(event, payload);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dispatchEvent(target: any, args: any): SocketIOClient.Socket {
    this.emit('debug', 'received: ' + JSON.stringify(args).slice(0, 1000));

    let result;
    const method = target[args.method];

    if (!method) {
      return this.emit('result', {
        id: args.id,
        error: {
          message: `Method "${args.method}" not found`,
        },
      });
    }

    try {
      result = method.call(this, args.params, args.id);
    } catch (e) {
      // TODO: replace this with TRUNCATED
      this.emit('debug', { message: e.message, stack: e.stack.slice(0, 1000) });
      return;
    }

    const isAsyncMethod = ASYNC_METHODS[args.domain as DomainName]?.[args.method];

    if (args?.params?.awaitPromise || isAsyncMethod) {
      if (typeof result.then !== 'function') {
        return this.emit('result', {
          id: args.id,
          error: {
            message: `Method "${args.method}" does not return a promise`,
          },
        });
      }
      result.then(
        (value: unknown) => {
          this.emit('result', {
            id: args.id,
            result: value,
            _method: args.method,
            _domain: args.domain,
          });
        },
        (error: Error) => {
          this.emit('result', {
            id: args.id,
            error: {
              message: `Method "${
                args.method
              }" rejects with ${error.toString()}`,
            },
            _method: args.method,
            _domain: args.domain,
          });
        }
      );
    } else {
      if (!result) {
        this.emit('debug', `no result for method "${method.name}"`);
        return;
      }

      this.emit('result', {
        id: args.id,
        result,
        _method: args.method,
        _domain: args.domain,
      });
    }
  }

  execute<Command extends keyof ExecuteCommandPayloadTypes>(
    method: Command,
    params: ExecuteCommandPayloadTypes[Command]
  ): void {
    this.emit('result', { method, params });
  }

  loadHandler(): void {
    this.readyStateComplete = true;
    this.domains.Runtime.init.call(this);
    this.domains.Runtime.executionContextCreated.call(this);
    this.domains.Debugger.scriptParsed.call(this);
    this.domains.Page.frameStoppedLoading.call(this);
    this.domains.Page.loadEventFired.call(this);
    this.domains.DOM.documentUpdated.call(this);
    this.domains.CSS.init.call(this);
    this.domains.Network.init.call(this);
    this.domains.Redux.init.call(this);

    /**
     * assign nodeIds to elements
     */
    setNodeIds(document);
    this.launcher.emitLifecycleEvent('ready');
  }

  unloadHandler(): void {
    this.domains.CSS.restore.call(this);
    this.domains.Network.restore.call(this);
    this.domains.Runtime.restore.call(this);
  }

  private registerPage(): void {
    const { devToolsBackendHost, uuid } = this.launcher;
    const deviceId = Cookie.get('deviceId');

    /**
     * register the target side
     */
    const {
      appName,
      appCodeName,
      appVersion,
      product,
      platform,
      vendor,
      userAgent,
    } = navigator;
    const description = getDescription();
    const title = getTitle();
    this.emit('registerPage', {
      uuid,
      url: document.location.href,
      description,
      title,
      deviceId,
      hostname: devToolsBackendHost,
      supportedDomains: SUPPORTED_DOMAINS,
      frameId: this.frameId,
      metadata: {
        appName,
        appCodeName,
        appVersion,
        product,
        platform,
        vendor,
        userAgent,
      },
    });
  }
}

export default RemoteDebugger;
