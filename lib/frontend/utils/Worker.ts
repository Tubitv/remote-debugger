import { LRUCache } from 'lru-fast';
import { v4 as uuidV4 } from 'uuid';

export class InlineWorker {
  private worker: Worker;
  private callbackMap: LRUCache<string, (result: unknown) => void>;
  private useWorker = false;

  constructor(evalScript: string) {
    const dataURL = `data:text/javascript;base64,${btoa(evalScript)}`;
    try {
      this.worker = new Worker(dataURL);
      this.worker.addEventListener('message', this.handleEvalResult);
      this.useWorker = true;
    } catch (ex) {
      // ignore errors
    }
    this.callbackMap = new LRUCache(500);
  }

  eval(expression: string): Promise<unknown> {
    if (!this.useWorker) {
      // eslint-disable-next-line no-eval
      return Promise.resolve(eval(expression));
    }
    return new Promise((resolve) => {
      const id = uuidV4();
      this.callbackMap.set(id, resolve);
      this.worker.postMessage({
        id,
        code: expression,
      });
    });
  }

  handleEvalResult = (event: MessageEvent): void => {
    const { id, evaluated } = event.data;
    const resolve = this.callbackMap.get(id);
    resolve(evaluated);
  };

  destroy(): void {
    if (!this.useWorker) return;
    this.worker.removeEventListener('message', this.handleEvalResult);
    if (!__TESTING__) {
      // jsdom-worker has not supported terminate yet
      // https://github.com/developit/jsdom-worker/blob/master/src/index.js#L73-L75
      this.worker.terminate();
    }
  }
}
