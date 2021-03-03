import Page from '../page';
import { Middleware } from './base';

class PageMiddleware extends Middleware {
  /**
   * Information about the Frame hierarchy along with their cached resources.
   * @return {Object} frame tree
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getResourceTree(this: Page, result: any, requestList: Page['requestList'] = []): any {
    const id = result.frameTree.frame.id.split('.')[0];
    const resources = requestList.filter(
      request => request.requestId && request.requestId.indexOf(id) === 0
    );

    /**
     * add resource data
     */
    result.frameTree.resources = resources.map(request => ({
      contentSize: request.requestBodySize,
      lastModified: request.wallTime,
      mimeType: request.mimeType,
      type: request.type,
      url: request.fullUrl,
    }));

    return result;
  }
}

export const pageMiddleware = new PageMiddleware();
