import zlib from 'zlib';
import Protocol from 'devtools-protocol';

import { hasGzipEncoding } from '../../utils';
import Page from '../page';
import { Domain } from './base';

const FRAME_ID_REGEXP = /frameId=(\d+\.\d+)/;

export class PageDomain extends Domain {
  /**
   * Fired once navigation of the frame has completed. Frame is now associated with
   * the new loader.
   */
  frameNavigated(page: Page, frameId: string, origin: string, url: string): void {
    page.send({
      method: 'Page.frameNavigated',
      params: {
        frame: {
          id: frameId,
          loaderId: frameId + '0',
          mimeType: 'text/html',
          securityOrigin: origin,
          url: origin + url,
        },
      },
    });
  }

  /**
   * trigger frameStartedLoading event once application was served by proxy
   */
  frameStartedLoading(page: Page, headers: { 'set-cookie': string[] | string }): void {
    const originalSetCookieHeader = headers['set-cookie'];
    /**
     * response headers can be a string or string array
     */
    const setCookieHeader = typeof originalSetCookieHeader === 'string'
      ? originalSetCookieHeader
      : originalSetCookieHeader.join('');

    /**
     * return if cookies aren't set
     */
    if (!setCookieHeader || !setCookieHeader.match(FRAME_ID_REGEXP)) {
      return;
    }

    const frameId = setCookieHeader.match(FRAME_ID_REGEXP)[1];
    page.send({
      method: 'Page.frameStartedLoading',
      params: { frameId },
    });
  }

  /**
   * Returns content of the given resource.
   *
   * @param {Number}  id      socket id
   * @param {Object}  params  parameter object containing requestId
   * @return                  response as base64 encoded
   */
  getResourceContent(page: Page, { id, params }: { id: string; params: Protocol.Page.GetResourceContentRequest }): { error: string } | { content: string } | void {
    const request = page.requestList.filter(req => req.fullUrl === params.url)[0];

    if (!request) {
      return {
        error: `Couldn't find request with id ${params.frameId} and url ${params.url}`,
      };
    }

    /**
     * if request in not encoded return immediately
     */
    if (!hasGzipEncoding(request.request)) {
      return { content: request.chunks.join('') };
    }

    /**
     * images are not gzipped
     */
    if (request.type.toLowerCase() === 'image') {
      return page.send({
        id,
        result: {
          base64Encoded: true,
          content: Buffer.concat(request.chunks).toString('base64'),
        },
      });
    }

    zlib.gunzip(Buffer.concat(request.chunks), (err, body) => {
      if (err) {
        return page.log.error(err);
      }

      if (!body) {
        page.log.error(new Error('Gzip decoding failed'));
        return;
      }

      return page.send({
        id,
        result: {
          base64Encoded: false,
          body: body.toString(),
        },
      });
    });
  }
}

export const pageDomain = new PageDomain();
