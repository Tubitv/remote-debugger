import Page from 'backend/page';

export abstract class Middleware {
  [name: string]: <T>(this: Page, result: T, requestList: Page['requestList']) => T;
}
