import RemoteDebugger from 'frontend/remoteDebugger';

import { ResponseMap } from './ResponseMap';
import {
  getNecessaryIds,
  matchReq,
  getLatestResourceTimingForUrl,
  now,
  sleep,
} from './tools';
import { MockMap } from './MockMap';
import { Emulator } from './Emulator';

type NecessaryIdsMap = {
  requestId: string;
  loaderId: string;
  frameId: string;
};

declare type GlobalFetch = WindowOrWorkerGlobalScope;
let originFetch: GlobalFetch['fetch'] | null = null;

function getHeadersMap(headers: HeadersInit): { [id: string]: string } {
  const map: { [id: string]: string} = {};
  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      map[key] = value;
    });
  } else if (Array.isArray(headers)) {
    headers.forEach(arr => {
      map[arr[0]] = arr[1];
    });
  } else {
    for (const key in headers) {
      map[key] = headers[key];
    }
  }
  return map;
}

async function getRequestHeadersMap(
  requestInfo: RequestInfo,
  options: RequestInit = {}
): Promise<{ [id: string]: string }> {
  const request =
    typeof requestInfo !== 'string' && (await requestInfo.clone());
  const { headers: requestHeaders } = request || options;
  return getHeadersMap(requestHeaders);
}

async function sendRequestInfo({
  remoteDebugger,
  requestInfo,
  options = {},
  requestId,
  frameId,
  loaderId,
  requestHeadersMap,
}: {
  remoteDebugger: RemoteDebugger;
  requestInfo: RequestInfo;
  options?: RequestInit;
  requestHeadersMap: { [id: string]: string };
} & NecessaryIdsMap): Promise<void> {
  const url = typeof requestInfo === 'string' ? requestInfo : requestInfo.url;
  const request =
    typeof requestInfo !== 'string' && (await requestInfo.clone());
  const { referrerPolicy, body } = request || options;
  const postData = request
    ? await request.text()
    : typeof body === 'string'
      ? body
      : body
        ? body.toString()
        : '';
  // Definition: https://chromedevtools.github.io/devtools-protocol/tot/Network#event-requestWillBeSent
  remoteDebugger.execute('Network.requestWillBeSent', {
    requestId,
    frameId,
    loaderId,
    documentURL: document.location.href,
    hasUserGesture: false,
    type: 'Fetch',
    request: {
      url,
      method: options.method || 'GET',
      headers: requestHeadersMap,
      // mixedContentType: 'none',
      postData,
      initialPriority: 'High',
      referrerPolicy: referrerPolicy || 'no-referrer-when-downgrade',
    },
    timestamp: now() / 1e3,
    wallTime: now() / 1e3,
    // TODO: We can do better here
    // Definition: https://chromedevtools.github.io/devtools-protocol/tot/Network#type-Initiator
    initiator: { type: 'script' },
  });
}

async function sendResponseSuccessInfo({
  remoteDebugger,
  requestId,
  frameId,
  loaderId,
  response,
  responseMap,
  requestHeadersMap,
  options = {},
}: {
  remoteDebugger: RemoteDebugger;
  response: Response;
  responseMap: ResponseMap;
  requestHeadersMap: { [id: string]: string };
  options: RequestInit;
} & NecessaryIdsMap): Promise<void> {
  const { url, status, statusText, headers } = response;
  responseMap.set(requestId, response, options.method || 'GET');
  const headersMap = getHeadersMap(headers);
  // TODO: it seems we can't get the encoded data length by JavaScript. Can we solve this later
  const contentLength = parseInt(headers.get('content-length'), 10) || 0;
  const timestamp = now() / 1000;
  // We need to wait for the resource timing generated
  await sleep();
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
    type: 'Fetch',
    // Definition: https://chromedevtools.github.io/devtools-protocol/tot/Network#type-Response
    response: {
      url,
      status,
      statusText,
      mimeType: headers.get('Content-Type'),
      headers: headersMap,
      requestHeaders: requestHeadersMap,
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
}

export function init(remoteDebugger: RemoteDebugger, responseMap: ResponseMap, mockMap: MockMap, emulator: Emulator): void {
  if (originFetch || !window.fetch) {
    return;
  }
  originFetch = window.fetch;
  window.fetch = async (...args): Promise<Response> => {
    const [requestInfo, options = {}] = args;
    const url = typeof requestInfo === 'string' ? requestInfo : requestInfo.url;

    if (matchReq(url)) {
      return originFetch(...args);
    }

    const necessaryIdsMap = getNecessaryIds(remoteDebugger, url, options.method || 'GET');
    const requestHeadersMap = await getRequestHeadersMap(requestInfo, options);
    sendRequestInfo({
      remoteDebugger,
      ...necessaryIdsMap,
      requestInfo,
      options,
      requestHeadersMap,
    });
    // Update request if it match
    args[0] = mockMap.handleRequest(requestInfo);

    const startTimestamp = Date.now();
    const result = originFetch(...args);
    result
      .then(response => emulator.handleResponseInPromise(response, startTimestamp))
      .then(response => {
        const cloneResponse = response.clone();
        sendResponseSuccessInfo({
          remoteDebugger,
          ...necessaryIdsMap,
          requestHeadersMap,
          response,
          responseMap,
          options,
        });
        return cloneResponse;
      })
      .catch(error => {
        // https://chromedevtools.github.io/devtools-protocol/tot/Network#event-loadingFailed
        remoteDebugger.execute('Network.loadingFailed', {
          requestId: necessaryIdsMap.requestId,
          timestamp: now() / 1000,
          type: 'Fetch',
          errorText: error.message,
          canceled: false,
        });
        // We still need to throw that error out
        throw error;
      });
    return result;
  };
}

export function restore(): void {
  if (!originFetch) {
    return;
  }
  window.fetch = originFetch;
  originFetch = null;
}
