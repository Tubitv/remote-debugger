import RemoteDebugger from 'frontend/remoteDebugger';
import Protocol from 'devtools-protocol';

import { getNecessaryIds, matchReq, hasRequestId } from './tools';

let cursor = 0;
let timer: NodeJS.Timeout = null;

function getType(
  e: string
): {
  type: 'XHR' | 'Script' | 'Stylesheet' | 'Image' | 'Document' | 'XHR';
  mime:
    | 'application/json'
    | 'text/javascript'
    | 'text/css'
    | 'image/png'
    | 'text/html'
    | 'application/json';
} {
  switch (e) {
  case 'xmlhttprequest':
    return {
      type: 'XHR',
      mime: 'application/json',
    };
  case 'script':
    return {
      type: 'Script',
      mime: 'text/javascript',
    };
  case 'link':
    return {
      type: 'Stylesheet',
      mime: 'text/css',
    };
  case 'css':
  case 'img':
    return {
      type: 'Image',
      mime: 'image/png',
    };
  case 'navigation':
    return {
      type: 'Document',
      mime: 'text/html',
    };
  default:
    return {
      type: 'XHR',
      mime: 'application/json',
    };
  }
}

function checkResourceTiming(remoteDebugger: RemoteDebugger): void {
  if (!window.performance) return;
  const entries = window.performance.getEntriesByType('resource');
  for (let i = cursor; i < entries.length; i++) {
    const entry = entries[i];
    const {
      // The name of resource timing is the URL actually.
      name,
      initiatorType,
      startTime,
      responseEnd,
      encodedBodySize,
    } = entry as PerformanceResourceTiming;
    if (hasRequestId(name, 'GET')) {
      continue;
    }
    const necessaryIdsMap = getNecessaryIds(remoteDebugger, name, 'GET');
    const { mime, type } = getType(initiatorType);
    if (matchReq(name)) {
      continue;
    }
    remoteDebugger.execute('Network.requestWillBeSent', {
      ...necessaryIdsMap,
      documentURL: document.location.href,
      hasUserGesture: false,
      type,
      request: {
        url: name,
        method: 'GET',
        headers: {},
        // mixedContentType: 'none',
        postData: '',
        initialPriority: 'High',
        referrerPolicy: 'no-referrer-when-downgrade',
      },
      timestamp: startTime,
      wallTime: Date.now() / 1e3,
      // Definition: https://chromedevtools.github.io/devtools-protocol/tot/Network#type-Initiator
      initiator: { type: initiatorType as unknown as Protocol.Network.RequestWillBeSentEvent['initiator']['type'] },
    });
    // Definition: https://chromedevtools.github.io/devtools-protocol/tot/Network#event-responseReceived
    remoteDebugger.execute('Network.responseReceived', {
      ...necessaryIdsMap,
      timestamp: responseEnd,
      // Definition: https://chromedevtools.github.io/devtools-protocol/tot/Network#type-ResourceType
      type,
      // Definition: https://chromedevtools.github.io/devtools-protocol/tot/Network#type-Response
      response: {
        url: name,
        status: 200,
        statusText: 'OK',
        mimeType: mime,
        headers: {},
        requestHeaders: {},
        connectionReused: false,
        connectionId: 0,
        fromDiskCache: false,
        fromServiceWorker: false,
        encodedDataLength: encodedBodySize,
        securityState: 'neutral',
      },
    });
    remoteDebugger.execute('Network.dataReceived', {
      ...necessaryIdsMap,
      timestamp: responseEnd,
      dataLength: encodedBodySize,
      encodedDataLength: encodedBodySize,
    });
    remoteDebugger.execute('Network.loadingFinished', {
      ...necessaryIdsMap,
      timestamp: responseEnd,
      encodedDataLength: encodedBodySize,
    });
  }
  if (window.performance.clearResourceTimings) {
    window.performance.clearResourceTimings();
  } else {
    cursor = entries.length;
  }
}

export function restore(): void {
  clearTimeout(timer);
  timer = null;
}

function poll(remoteDebugger: RemoteDebugger): void {
  restore();
  timer = setTimeout(() => {
    checkResourceTiming(remoteDebugger);
    poll(remoteDebugger);
  }, 1000);
}

export function init(remoteDebugger: RemoteDebugger): void {
  if (!window.performance || typeof window.performance.getEntriesByType !== 'function') {
    return;
  }
  poll(remoteDebugger);
}
