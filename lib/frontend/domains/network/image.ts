import { LRUCache } from 'lru-fast';
import RemoteDebugger from 'frontend/remoteDebugger';

import { getRequestId, getLatestResourceTimingForUrl, matchReq, now } from './tools';

let OriginImage: typeof Image | null = null;
let lru: LRUCache<string, string>;

export function init(remoteDebugger: RemoteDebugger): void {
  const OriginImage = Image;
  const newImage = (width?: number, height?: number): HTMLImageElement => (new (Function.bind.apply(OriginImage as unknown, [null, width, height]) as unknown as typeof Image)()) as HTMLImageElement;

  lru = new LRUCache(100);
  // @ts-ignore: The error says that Window has not image here
  window.Image = function(...args): HTMLImageElement & { _src?: string } {
    const image: HTMLImageElement & { _src?: string } = newImage(...args);
    image._src = image.src;
    let requestId: string;
    const { frameId } = remoteDebugger;
    const loaderId = frameId + '0';

    Object.defineProperty(image, 'src', {
      get() {
        return this._src;
      },
      set(url) {
        this._src = url;
        image.setAttribute('src', url);
        if (lru.get(url) || !url || !OriginImage || matchReq(url)) {
          return;
        }
        requestId = getRequestId(url, 'GET');
        lru.set(url, requestId);
        // Definition: https://chromedevtools.github.io/devtools-protocol/tot/Network#event-requestWillBeSent
        remoteDebugger.execute('Network.requestWillBeSent', {
          requestId,
          frameId,
          loaderId,
          documentURL: document.location.href,
          hasUserGesture: false,
          type: 'Image',
          request: {
            url,
            method: 'get',
            headers: {},
            initialPriority: 'Low',
            // TODO: how to get the correct value here
            referrerPolicy: 'no-referrer-when-downgrade',
          },
          timestamp: now() / 1e3,
          wallTime: now() / 1e3,
          // TODO: We can do better here
          // Definition: https://chromedevtools.github.io/devtools-protocol/tot/Network#type-Initiator
          initiator: { type: 'script' },
        });
      },
      configurable: true,
    });

    image.addEventListener('load', () => {
      if (lru.get(image.src) !== requestId || !OriginImage || matchReq(image.src)) {
        return;
      }
      const contentLength = 0;
      const timestamp = now() / 1000;
      const resourceTiming = getLatestResourceTimingForUrl(image.src);
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
        type: 'Image',
        // Definition: https://chromedevtools.github.io/devtools-protocol/tot/Network#type-Response
        response: {
          url: image.src,
          status: 200,
          statusText: 'ok',
          // TODO: this is a fake mime type
          mimeType: 'Image',
          headers: {},
          requestHeaders: {},
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
    });

    image.addEventListener('error', error => {
      remoteDebugger.execute('Network.loadingFailed', {
        requestId,
        timestamp: now() / 1000,
        type: 'Image',
        errorText: error.message,
        canceled: false,
      });
    });
    return image;
  };
}
export function restore(): void {
  if (OriginImage) {
    // @ts-ignore
    window.Image = OriginImage;
    OriginImage = null;
  }
  if (lru) {
    lru.removeAll();
  }
}
