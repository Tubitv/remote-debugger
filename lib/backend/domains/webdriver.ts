import { UrlWithStringQuery } from 'url';

import Page from '../page';
import { Domain } from './base';

/**
 * Custom Webdriver domain
 */
export class WebdriverDomain extends Domain {
  /**
   * Return page infos
   */
  info(page: Page): {
    uuid: string;
    hostname: string;
    url: UrlWithStringQuery;
    title: string;
    description: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata: any;
  } {
    const { uuid, hostname, url, title, description, metadata } = page;
    return { uuid, hostname, url, title, description, metadata };
  }
}

export const webdriverDomain = new WebdriverDomain();
