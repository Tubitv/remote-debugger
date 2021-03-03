import Page from '../page';
import { Domain } from './base';
/**
 * Events
 */
export class TargetDomain extends Domain {
  /**
   * Issued when a possible inspection target is created.
   * @param  {String} uuid  page target passed in by debugger service
   * @return {Object}       target info
   */
  targetCreated(page: Page): void {
    const { uuid: targetId, title, url } = page;
    page.send({
      method: 'Target.targetCreated',
      params: { targetInfo: { targetId, title, type: 'page', url } },
    });
  }
}

export const targetDomain = new TargetDomain();
