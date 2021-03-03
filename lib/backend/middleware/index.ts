import { pageMiddleware } from './page';
import { debuggerMiddleware } from './debugger';
import { Middleware } from './base';

export const middlewares: { [name: string]: Middleware } = {
  Page: pageMiddleware,
  Debugger: debuggerMiddleware,
};
