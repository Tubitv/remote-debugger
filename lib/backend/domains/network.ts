import zlib from 'zlib';
import Protocol from 'devtools-protocol';
import { LRUCache } from 'lru-fast';

import Page from '../page';
import { hasGzipEncoding } from '../../utils';
import { Domain } from './base';

export class NetworkDomain extends Domain {
  private handlerMap: LRUCache<string, { resolve: (params: { id: string; result: Protocol.Network.GetResponseBodyResponse}) => void; id: string; timer: NodeJS.Timeout }>
  constructor() {
    super();
    this.handlerMap = new LRUCache(500);
  }

  addListenerOnPageTargetSocket(page: Page): void {
    page.targetSocket.on('Network.getResponseBody-response', this.handleGetResponseBodyResponse);
  }

  handleGetResponseBodyResponse = (response: Protocol.Network.GetResponseBodyResponse & { uuid: string }): void => {
    const { uuid, ...result } = response;
    const cache = this.handlerMap.get(uuid);
    if (!cache) {
      return;
    }
    this.handlerMap.remove(uuid);
    const { resolve, id, timer } = cache;
    clearTimeout(timer);
    resolve({
      result,
      id,
    });
  }

  getResponseBodyData(page: Page, {
    id,
    params,
  }: {
    id: string;
    params: Protocol.Network.GetResponseBodyRequest;
  }): Promise<{ id: string; result: Protocol.Network.GetResponseBodyResponse}> {
    const request = page.requestList.filter(
      req => req.requestId === params.requestId
    )[0];

    if (!request) {
      return new Promise<{ id: string; result: Protocol.Network.GetResponseBodyResponse}>((resolve, reject) => {
        const uuid = `${page.uuid}_${params.requestId}`;
        const timer = setTimeout(() => {
          const error = new Error(`Timeout for ${id}`);
          reject(error);
        }, 20000);
        this.handlerMap.set(uuid, { resolve, id, timer });
        page.targetSocket.emit('Network.getResponseBody', { ...params, uuid });
      }).catch(error => {
        console.error(error);
        return Promise.reject(
          new Error(`Couldn't find request with id ${params.requestId}`)
        );
      });
    }

    /**
     * if request in not encoded return immediately
     */
    if (!hasGzipEncoding(request.request)) {
      return Promise.resolve({
        id,
        result: {
          base64Encoded: false,
          body: request.chunks.join(''),
        },
      });
    }

    /**
     * images are not gzipped
     */
    if (request.type.toLowerCase() === 'image') {
      return Promise.resolve({
        id,
        result: {
          base64Encoded: true,
          body: Buffer.concat(request.chunks).toString('base64'),
        },
      });
    }

    return new Promise((resolve, reject) =>
      zlib.gunzip(Buffer.concat(request.chunks), (err, body) => {
        if (err) {
          /**
           * return as if not encoded
           * some JS files have accept-encoding: gzip, deflate but are not
           * actually gzipped
           */
          return resolve({
            id,
            result: {
              base64Encoded: false,
              body: request.chunks.join(''),
            },
          });
        }

        if (!body) {
          const gzipError = new Error('Gzip decoding failed');
          page.log.error(gzipError);
          return reject(gzipError);
        }

        return resolve({
          id,
          result: {
            base64Encoded: false,
            body: body.toString(),
          },
        });
      })
    );
  }

  /**
   * Returns content served for the given request.
   *
   * @param {Number}  id      socket id
   * @param {Object}  params  parameter object containing requestId
   * @return                  response as base64 encoded
   */
  getResponseBody(page: Page, {
    id,
    params,
  }: {
    id: string;
    params: Protocol.Network.GetResponseBodyRequest;
  }): void {
    this.getResponseBodyData(page, { id, params }).then(
      data => page.send(data),
      e => page.log.error(e)
    );
  }

  getCookies(page: Page, { id, params }: { id: string; params: Protocol.Network.GetCookiesRequest }): void {
    page.targetSocket.once('Network.getCookies-response', result => {
      page.send({
        id,
        result,
      });
    });
    page.targetSocket.emit('Network.getCookies', params);
  }

  setCookie(page: Page, { params }: { id: string; params: Protocol.Network.SetCookieRequest }): void {
    page.targetSocket.emit('Network.setCookie', params);
  }

  deleteCookies(page: Page, { id, params }: { id: string; params: Protocol.Network.DeleteCookiesRequest }): void {
    page.targetSocket.once('Network.deleteCookies-response', result => {
      page.send({ id, result });
    });
    page.targetSocket.emit('Network.deleteCookies', params);
  }

  emulateNetworkConditions(page: Page, { method, params }: { method: 'Network.emulateNetworkConditions'; params: Protocol.Network.EmulateNetworkConditionsRequest}): void {
    page.targetSocket.emit(method, params);
  }
}

export const networkDomain = new NetworkDomain();
