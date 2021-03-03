import Page from 'backend/page';

type NetworkDomainMethodName =
  | 'startListenerMonitor'
  | 'getResponseBody'
  | 'getCookies'
  | 'setCookie'
  | 'deleteCookies';

type LogDomainMethodName = 'entryAdded';

type PageDomainMethodName =
  | 'frameNavigated'
  | 'frameStartedLoading'
  | 'getResourceContent';

type TargetDomainMethodName = 'targetCreated';

type WebdriverDomainMethodName = 'info';

type DomainMethodName =
  & NetworkDomainMethodName
  & LogDomainMethodName
  & PageDomainMethodName
  & TargetDomainMethodName
  & WebdriverDomainMethodName;

type DomainMethodPattern = {
  [key in DomainMethodName]?: (page: Page, ...args: unknown[]) => void;
};

export abstract class Domain implements DomainMethodPattern {}
