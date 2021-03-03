import RemoteDebugger from 'frontend/remoteDebugger';
import { WrappedXMLHttpRequest } from 'frontend/domains/network/xhr';

const DEFAULT_NETWORK_CONDITION = {
  offline: false,
  latency: 0,
  downloadThroughput: 0,
  uploadThroughput: 0,
};

type NetworkCondition = typeof DEFAULT_NETWORK_CONDITION;

export class Emulator {
  private networkCondition: NetworkCondition;

  constructor(private remoteDebugger: RemoteDebugger) {
    this.networkCondition = DEFAULT_NETWORK_CONDITION;
  }

  getDelayTime(contentLength: number, startTimestamp: number): number {
    const { downloadThroughput, latency } = this.networkCondition;
    const currentTimestamp = Date.now();
    if (!downloadThroughput && !latency) {
      return 0;
    }
    const downloadTime = contentLength / downloadThroughput;
    const elapsedTime = currentTimestamp - startTimestamp;
    const delayTime = Math.max(0, latency + downloadTime - elapsedTime);
    return delayTime;
  }

  handleResponseInPromise = (response: Response, startTimestamp: number): Promise<Response> => {
    return new Promise((resolve) => {
      if (this.networkCondition.offline) {
        throw new TypeError('Failed to fetch');
      }
      const { headers } = response;
      const contentLength = parseInt(headers.get('content-length'), 10) || 0;
      const delayTime = this.getDelayTime(contentLength, startTimestamp);
      if (delayTime === 0) {
        resolve(response);
        return;
      }
      setTimeout(() => {
        resolve(response);
      }, delayTime);
    });
  }

  simulateOfflineOnXMLHttpRequest = (xhr: XMLHttpRequest): void => {
    const baseConfig = {
      configurable: true,
      writable: true,
      value: '',
    };
    Object.defineProperties(xhr, {
      status: {
        ...baseConfig,
        value: 0,
      },
      statusText: baseConfig,
      response: baseConfig,
      responseText: baseConfig,
      responseType: baseConfig,
      responseURL: baseConfig,
    });
    xhr.dispatchEvent(new Event('error'));
  }

  handleEventOfXMLHttpRequest(xhr: WrappedXMLHttpRequest, event: Event): void {
    const eventType = event.type as (keyof XMLHttpRequestEventTargetEventMap | 'readystatechange');
    let delayTime = 0;
    let cloneEvent: Event & { isCloned?: boolean };
    switch (eventType) {
    case 'abort':
    case 'error':
    case 'timeout':
      // Do nothing
      return;
    case 'loadstart':
    case 'loadend':
    case 'load':
      {
        const progressEvent = event as ProgressEvent;
        const { loaded, lengthComputable, total, type } = progressEvent;
        if (!lengthComputable) {
          return;
        }
        delayTime = this.getDelayTime(loaded, xhr.xhrInfo.startTimestamp);
        if (delayTime === 0) {
          return;
        }
        cloneEvent = new ProgressEvent(type, { loaded, total, lengthComputable });
      }
      break;
    case 'readystatechange':
    {
      if (xhr.readyState !== 4) {
        return;
      }
      if (this.networkCondition.offline) {
        this.simulateOfflineOnXMLHttpRequest(xhr);
        return;
      }
      const { responseHeaders = {}, startTimestamp } = xhr.xhrInfo;
      const contentLength = parseInt(responseHeaders['content-length'], 10) || 10;
      delayTime = this.getDelayTime(contentLength, startTimestamp);
      if (delayTime === 0) {
        return;
      }
      cloneEvent = new Event(event.type);
      break;
    }
    default:
      return;
    }
    cloneEvent.isCloned = true;
    // Stop original event
    event.stopImmediatePropagation();
    setTimeout(() => {
      xhr.dispatchEvent(cloneEvent);
    }, delayTime);
  }

  updateNetworkConditions = (networkCondition: NetworkCondition): void => {
    this.networkCondition = networkCondition;
  }
}
