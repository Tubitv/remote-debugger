import RemoteDebugger from 'frontend/remoteDebugger';
import { LRUCache } from 'lru-fast';

import { getRemoteDebuggerOption } from '../../utils/common';

let reqId = 1000;
const cache: LRUCache<string, string> = new LRUCache(100);

export function getUrlWithProtocol(url: string): string {
  if (url.startsWith(location.protocol)) {
    return url;
  }
  return `${location.protocol}${url}`;
}

export function getRequestId(url: string, method: RequestInit['method']): string {
  // TODO: URL is not unique enough. we need to take method/headers/timestamp into consideration. Optimize this in the next version.
  const key = getUrlWithProtocol(url);
  if (method.toLowerCase() === 'get') {
    const oldId = cache.get(key);
    if (oldId) {
      return oldId;
    }
  }

  const id = (reqId++).toString();
  cache.set(key, id);
  return id;
}

export function hasRequestId(url: string, method: RequestInit['method']): boolean {
  if (method.toLowerCase() !== 'get') {
    return false;
  }
  const key = getUrlWithProtocol(url);
  return typeof cache.get(key) !== 'undefined';
}

export function getBase64FromBlob(blob: Blob): Promise<string | ArrayBuffer> {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onloadend = (): void => {
      const base64data = reader.result;
      resolve(base64data);
    };
    reader.readAsDataURL(blob);
  });
}

export function convertXHRResponseHeaderIntoMap(
  headers: string
): { [id: string]: string } {
  // Convert the header string into an array
  // of individual headers
  const arr = headers.trim().split(/[\r\n]+/);

  // Create a map of header names to values
  const headerMap: { [name: string]: string } = {};
  arr.forEach(function(line) {
    const parts = line.split(': ');
    const header = parts.shift();
    const value = parts.join(': ');
    headerMap[header] = value;
  });
  return headerMap;
}

const blockList = ['/register', 'socket.io'];
export function matchReq(url: string): boolean {
  return !!blockList.find(blockUrl => url.match(blockUrl));
}

export function getNecessaryIds(remoteDebugger: RemoteDebugger, url: string, method: RequestInit['method']): {
  requestId: string;
  frameId: string;
  loaderId: string;
} {
  const { frameId } = remoteDebugger;
  const loaderId = frameId + '0';
  return {
    requestId: getRequestId(url, method),
    frameId,
    loaderId,
  };
}

export function getLatestResourceTimingForUrl(url: string): PerformanceResourceTiming | void {
  if (!window.performance || typeof window.performance.getEntriesByName !== 'function') {
    return;
  }
  const name = getUrlWithProtocol(url);
  const entries = window.performance.getEntriesByName(name);
  const latestEntry = entries[
    entries.length - 1
  ] as PerformanceResourceTiming | void;
  return latestEntry;
}

export function isImageResponse(response: Response): boolean {
  const { headers } = response;
  const contentType = headers.get('Content-Type');
  return contentType && contentType.startsWith('image/');
}

export function now(): number {
  return window.performance ? window.performance.now() : Date.now();
}

export function sleep(timeout = 0): Promise<{}> {
  return new Promise(resolve => setTimeout(resolve, timeout));
}
