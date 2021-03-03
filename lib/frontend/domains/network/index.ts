import RemoteDebugger from 'frontend/remoteDebugger';

import { ClientToTargetEventPayloadTypes } from 'typings/common';

import { init as initFetch, restore as restoreFetch } from './fetch';
import { init as initXHR, restore as restoreXHR } from './xhr';
import { init as initImage, restore as restoreImage } from './image';
import {
  init as initSendBeacon,
  restore as restoreSendBeacon,
} from './sendBeacon';
import {
  init as initResourceTiming,
  restore as restoreResourceTiming,
} from './resourceTiming';
import { ResponseMap } from './ResponseMap';
import { MockMap } from './MockMap';
import { Emulator } from './Emulator';
import { CookieManager } from './cookie';

let responseMap: ResponseMap | null = null;
let mockMap: MockMap | null = null;
let emulator: Emulator | null = null;
let cookieManager: CookieManager | null = null;

function getResponseBody({ requestId, uuid }: ClientToTargetEventPayloadTypes['Network.getResponseBody']): void {
  responseMap && responseMap.getResponseBody(requestId, uuid);
}

export function init(this: RemoteDebugger): void {
  responseMap = new ResponseMap(this);
  mockMap = new MockMap(this);
  emulator = new Emulator(this);
  cookieManager = new CookieManager(this);
  initFetch(this, responseMap, mockMap, emulator);
  initXHR(this, responseMap, mockMap, emulator);
  initImage(this);
  initSendBeacon();
  initResourceTiming(this);
  this.socket.on('Network.getResponseBody', getResponseBody);
  // https://chromedevtools.github.io/devtools-protocol/tot/Network#method-emulateNetworkConditions
  this.socket.on('Network.emulateNetworkConditions', emulator.updateNetworkConditions);
  this.debugBridge.addNamespace('MockMap', {
    refresh: mockMap.refresh,
  });
}

export function restore(this: RemoteDebugger): void {
  restoreFetch();
  restoreXHR();
  restoreImage();
  restoreSendBeacon();
  restoreResourceTiming();
  this.socket.off('Network.getResponseBody', getResponseBody);
  if (responseMap) {
    responseMap.destroy();
    responseMap = null;
  }
  mockMap = null;
  emulator = null;
  if (cookieManager) {
    cookieManager.destroy();
    cookieManager = null;
  }
  this.debugBridge.removeNamespace('MockMap');
}
