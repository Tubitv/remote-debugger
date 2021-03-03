import { Parameters } from 'frontend/utils/typeTools';

let originSendBeacon: Navigator['sendBeacon'] | null = null;

// We can get nothing for the response by navigator.sendBeacon
// So we override it with fetch post
// TODO: serviceWorker may be can solve this problem, we will test on that later
export function init(): void {
  originSendBeacon = navigator.sendBeacon;
  navigator.sendBeacon = (
    ...args: Parameters<Navigator['sendBeacon']>
  ): boolean => {
    const [url, data] = args;
    fetch(url, {
      method: 'POST',
      body: data,
    });
    return true;
  };
}

export function restore(): void {
  if (!originSendBeacon) {
    return;
  }
  navigator.sendBeacon = originSendBeacon;
  originSendBeacon = null;
}
