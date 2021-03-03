import { DomainName } from 'typings/common';

import { networkDomain, NetworkDomain } from './network';
import { pageDomain, PageDomain } from './page';
import { logDomain, LogDomain } from './log';
import { targetDomain, TargetDomain } from './target';
import { webdriverDomain, WebdriverDomain } from './webdriver';
import { Domain } from './base';

export const domains: {
  Network: NetworkDomain;
  Page: PageDomain;
  Log: LogDomain;
  Target: TargetDomain;
  Webdriver: WebdriverDomain;
} & {
  [key in DomainName]?: Domain;
} = {
  Network: networkDomain,
  Page: pageDomain,
  Log: logDomain,
  Target: targetDomain,
  Webdriver: webdriverDomain,
};
