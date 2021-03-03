import url from 'url';
import http from 'http';
import { Socket } from 'net';
import { WebSocketMessage, DomainName, TargetToClientEventPayloadTypes } from 'typings/common';

import Page from './page';
import { domains } from './domains';
import logger, { WrappedLogger } from '../logger';
import { getRequestIp } from '../utils';

/**
 * Debugger Service
 * ================
 *
 * Contains the actual devtools backend logic. It manages devtools pages and analyses network
 * connection if it is run by a proxy.
 */
export default class Backend {
  public log: WrappedLogger;
  public pages: Page[];
  constructor(public targetSocketServer: SocketIO.Server) {
    this.log = logger('Backend');
    this.pages = [];
  }

  upgradeWssSocket(req: http.IncomingMessage, socket: Socket, head: Buffer): void {
    const pathname = url.parse(req.url).pathname;

    if (pathname.includes('socket.io')) {
      /**
       * This function is set for the client socket logic.
       * However, both the client WebSocket and the target WebSocket will run into this function.
       * So I need to add an early return here for the target socket.
       * Otherwise, the target socket can only send the message with polling.
       */
      return;
    }

    for (const page of this.pages) {
      if (pathname === `/devtools/page/${page.uuid}`) {
        return page.clientSocketServer.handleUpgrade(
          req,
          socket,
          head,
          page.connectClient.bind(page, getRequestIp(req))
        );
      }
    }

    socket.destroy();
  }

  bindPageWithTargetSocket(params: TargetToClientEventPayloadTypes['registerPage'], socket: SocketIO.Socket): Page {
    const registeredPage = this.pages.find(page => page.uuid === params.uuid);
    let page: Page;
    if (!registeredPage) {
      this.log.info(`Create a new page with uuid "${params.uuid}"`, params);

      page = new Page(params, socket);
      this.pages.push(page);

      /**
       * remove page if disconnected from devtools frontend
       */
      page.on('disconnect', uuid => this.removePage(uuid));
      page.on('incoming', params => this.handleIncoming(page, params));
    } else {
      this.log.info(`Page with uuid "${params.uuid}" already exists`);
      page = registeredPage;
      page.connectTarget(params, socket);
    }

    page.frameStartedLoading();
    return page;
  }

  removePage(uuid: string): void {
    this.log.info(`Removing page with uuid "${uuid}"`);
    const pageIndex = this.pages.findIndex(page => page.uuid === uuid);
    if (pageIndex < 0) {
      return;
    }

    const deletedPages = this.pages.splice(pageIndex, 1);

    /**
     * clear page so that listeners get removed
     */
    for (let i = 0; i < deletedPages.length; ++i) {
      deletedPages[i].destroy();
      delete deletedPages[i];
    }
  }

  /**
   * Handle devtools frontend incoming message and send it to target env
   */
  handleIncoming(page: Page, { domain, method, msg }: { domain: DomainName; method: string; msg: WebSocketMessage}): void {
    /**
     * check if method has to be executed on serverside
     */
    // @ts-ignore: This code is too dynamic, just ignore it.
    if (domains[domain] && typeof domains[domain][method] === 'function') {
      // @ts-ignore: This code is too dynamic, just ignore it.
      const result = domains[domain][method](page, msg);

      /**
       * some methods are async and broadcast their message on their own
       */
      if (!result) {
        return;
      }

      return page.send({ id: msg.id, result });
    }

    /**
     * if not handled on server side sent command to device
     */
    page.trigger(domain, {
      id: msg.id,
      method,
      domain,
      params: msg.params || {},
    });
  }
}
