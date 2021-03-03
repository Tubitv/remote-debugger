import Page from '../page';
import { Domain } from './base';
import { WrappedRequest } from '../utils/request';

export class LogDomain extends Domain {
  /**
   * Issued when new message was logged.
   *
   * @param  {LogEntry} entry  the entry
   */
  entryAdded(page: Page, request: WrappedRequest, error: Error): void {
    page.send({
      method: 'Log.entryAdded',
      params: {
        entry: {
          level: 'error',
          source: 'network',
          text: error.message,
          timestamp: new Date().getTime(),
          url: request.fullUrl,
          networkRequestId: request.requestId,
        },
      },
    });
  }
}

export const logDomain = new LogDomain();
