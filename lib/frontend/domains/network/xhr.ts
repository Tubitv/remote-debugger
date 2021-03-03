import RemoteDebugger from 'frontend/remoteDebugger';
import { Parameters } from 'frontend/utils/typeTools';

import { ResponseMap } from './ResponseMap';
import { MockMap } from './MockMap';
import {
  getRequestId,
  matchReq,
  convertXHRResponseHeaderIntoMap,
  getLatestResourceTimingForUrl,
  now,
} from './tools';
import { Emulator } from './Emulator';

let originSend: XMLHttpRequest['send'] | null = null;
let originOpen: XMLHttpRequest['open'] | null = null;
let originSetRequestHeader: XMLHttpRequest['setRequestHeader'] | null = null;
let OriginXHR: {
  new (): XMLHttpRequest;
  prototype: XMLHttpRequest;
  readonly DONE: number;
  readonly HEADERS_RECEIVED: number;
  readonly LOADING: number;
  readonly OPENED: number;
  readonly UNSENT: number;
} | null = null;

export type WrappedXMLHttpRequest = XMLHttpRequest & {
  requestId: string;
  xhrInfo: {
    method: string;
    url: string;
    async: boolean;
    user: string;
    password: string;
    headers: { [id: string]: string };
    responseHeaders?: { [id: string]: string };
    startTimestamp?: number;
  };
};

export function init(remoteDebugger: RemoteDebugger, responseMap: ResponseMap, mockMap: MockMap, emulator: Emulator): void {
  const { frameId } = remoteDebugger;
  const loaderId = frameId + '0';

  const winXhrProto = XMLHttpRequest.prototype;

  originSend = winXhrProto.send;
  originOpen = winXhrProto.open;
  originSetRequestHeader = winXhrProto.setRequestHeader;
  OriginXHR = XMLHttpRequest;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).XMLHttpRequest = (): XMLHttpRequest => {
    const instance = new OriginXHR();
    const eventLists = ['load', 'loadend', 'loadstart', 'progress', 'readystatechange'];
    eventLists.forEach(name => {
      // Handle event in the capture mode, so that we can stop them  immediately
      instance.addEventListener(name, function(this: WrappedXMLHttpRequest, event) {
        if (!matchReq(this.xhrInfo.url) &&
          // @ts-ignore: Custom event mark
          !event.isCloned) {
          emulator.handleEventOfXMLHttpRequest(this, event);
        }
      }, true);
    });
    return instance;
  };

  // @ts-ignore: error is caused by overload function, solve this later
  winXhrProto.open = function(
    this: WrappedXMLHttpRequest,
    ...args: Parameters<XMLHttpRequest['open']>
  ): void {
    const [method, url, async, user, password] = args;
    const requestId = getRequestId(url, method);
    this.requestId = requestId;
    this.xhrInfo = {
      method,
      url,
      async,
      user,
      password,
      headers: {},
    };
    args[1] = mockMap.handleRequest(url);
    return originOpen.apply(this, args);
  };

  winXhrProto.send = function(
    this: WrappedXMLHttpRequest,
    ...args: Parameters<XMLHttpRequest['send']>
  ): void {
    const { requestId, xhrInfo } = this;
    const { method, url, headers } = xhrInfo;
    this.xhrInfo.startTimestamp = Date.now();
    if (matchReq(url)) {
      return originSend.apply(this, args);
    }
    const data = args[0];
    // TODO: need to improve this later
    const postData =
      typeof data === 'string' ? data : (data ? data.toString() : '');
    // Definition: https://chromedevtools.github.io/devtools-protocol/tot/Network#event-requestWillBeSent
    remoteDebugger.execute('Network.requestWillBeSent', {
      requestId,
      frameId,
      loaderId,
      documentURL: document.location.href,
      hasUserGesture: false,
      type: 'XHR',
      request: {
        url,
        method,
        headers,
        postData,
        initialPriority: 'High',
        // TODO: how to get the correct value here
        referrerPolicy: 'no-referrer-when-downgrade',
      },
      timestamp: now() / 1000,
      wallTime: now() / 1000,
      // TODO: We can do better here
      // Definition: https://chromedevtools.github.io/devtools-protocol/tot/Network#type-Initiator
      initiator: { type: 'script' },
    });

    this.addEventListener('readystatechange', () => {
      switch (this.readyState) {
      case 2:
        return ((): void => {
          this.xhrInfo.responseHeaders = convertXHRResponseHeaderIntoMap(
            this.getAllResponseHeaders()
          );
        })();
      case 4:
        return ((): void => {
          const { requestId, xhrInfo, status } = this;
          if (status === 0) {
            return;
          }
          const { url, headers, responseHeaders = {} } = xhrInfo;
          const contentLength =
              parseInt(responseHeaders['content-length'], 10) || 0;
          const timestamp = now() / 1000;
          const { responseType } = this;
          if (
            !['arraybuffer', 'blob', 'document', 'ms-stream'].includes(
              responseType
            )
          ) {
            responseMap.set(requestId, {
              body: this.response,
              responseType,
            }, method);
          }
          const resourceTiming = getLatestResourceTimingForUrl(url);
          const encodedDataLength = resourceTiming
            ? resourceTiming.encodedBodySize
            : contentLength;
          const dataLength = resourceTiming
            ? resourceTiming.decodedBodySize
            : contentLength;
            // Definition: https://chromedevtools.github.io/devtools-protocol/tot/Network#event-responseReceived
          remoteDebugger.execute('Network.responseReceived', {
            requestId,
            frameId,
            loaderId,
            timestamp,
            // Definition: https://chromedevtools.github.io/devtools-protocol/tot/Network#type-ResourceType
            type: 'XHR',
            // Definition: https://chromedevtools.github.io/devtools-protocol/tot/Network#type-Response
            response: {
              url,
              status: this.status,
              statusText: this.statusText,
              mimeType: responseHeaders['content-type'],
              headers: responseHeaders,
              requestHeaders: headers,
              connectionReused: false,
              connectionId: 0,
              fromDiskCache: false,
              fromServiceWorker: false,
              encodedDataLength,
              securityState: 'neutral',
            },
          });
          remoteDebugger.execute('Network.dataReceived', {
            requestId,
            timestamp,
            dataLength,
            encodedDataLength,
          });
          remoteDebugger.execute('Network.loadingFinished', {
            requestId,
            timestamp,
            encodedDataLength,
          });
        })();
      }
    });
    this.addEventListener('error', event => {
      remoteDebugger.execute('Network.loadingFailed', {
        requestId,
        timestamp: now() / 1000,
        type: 'XHR',
        errorText: event.type,
        canceled: false,
      });
    });
    this.addEventListener('abort', event => {
      remoteDebugger.execute('Network.loadingFailed', {
        requestId,
        timestamp: now() / 1000,
        type: 'XHR',
        errorText: event.type,
        canceled: true,
      });
    });
    return originSend.apply(this, args);
  };

  winXhrProto.setRequestHeader = function(this: WrappedXMLHttpRequest, ...args): void {
    const [header, value] = args;
    this.xhrInfo.headers = this.xhrInfo.headers || {};
    this.xhrInfo.headers[header] = value;
    return originSetRequestHeader.apply(this, args);
  };
}

export function restore(): void {
  if (OriginXHR) {
    // eslint-disable-next-line no-global-assign
    XMLHttpRequest = OriginXHR;
  }

  const winXhrProto = XMLHttpRequest.prototype;

  if (originSend) {
    winXhrProto.send = originSend;
    originSend = null;
  }

  if (originOpen) {
    winXhrProto.open = originOpen;
    originOpen = null;
  }

  if (originSetRequestHeader) {
    winXhrProto.setRequestHeader = originSetRequestHeader;
    originSetRequestHeader = null;
  }
}
