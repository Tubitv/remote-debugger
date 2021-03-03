import each from 'jest-each';

import { RemoteDebugger } from '../../remoteDebugger';
import { remoteDebuggerLauncher } from '../../launcher.bundle';
import { WrappedXMLHttpRequest } from './xhr';

import 'whatwg-fetch';

import { Emulator } from './Emulator';

const ONLINE = {
  connectionType: 'online',
  downloadThroughput: 0,
  latency: 0,
  offline: false,
  uploadThroughput: 0,
};

const OFFLINE = {
  connectionType: 'none',
  downloadThroughput: 0,
  latency: 0,
  offline: true,
  uploadThroughput: 0,
};

const FAST_3G = {
  connectionType: 'cellular3g',
  downloadThroughput: 188743.68000000002,
  latency: 562.5,
  offline: false,
  uploadThroughput: 86400,
};

const SLOW_3G = {
  connectionType: 'cellular3g',
  downloadThroughput: 51200,
  latency: 2000,
  offline: false,
  uploadThroughput: 51200,
};

describe('frontend domains network', () => {
  let emulator: Emulator;
  let remoteDebugger: RemoteDebugger;

  beforeEach(() => {
    remoteDebugger = new RemoteDebugger(remoteDebuggerLauncher, 'uuid', 'http://localhost');
    emulator = new Emulator(remoteDebugger);
  });

  afterEach(() => {
    remoteDebugger.destroy();
    emulator = null;
  });

  test('updateNetworkConditions', () => {
    emulator.updateNetworkConditions(OFFLINE);
    // @ts-ignore: ignore private interface error
    expect(emulator.networkCondition).toBe(OFFLINE);
  });

  describe('getDelayTime', () => {
    test('should be zero when it is online', () => {
      expect(emulator.getDelayTime(1000, Date.now())).toBe(0);
    });

    test('should return proper time according to the calculation', () => {
      emulator.updateNetworkConditions(SLOW_3G);
      expect(Math.floor(emulator.getDelayTime(SLOW_3G.downloadThroughput * 2, Date.now()))).toBe(2002);
    });
  });

  describe('handleResponseInPromise', () => {
    test('should throw error when it is offline', () => {
      emulator.updateNetworkConditions(OFFLINE);
      expect(emulator.handleResponseInPromise(new Response(), Date.now())).rejects.toThrowError('Failed to fetch');
    });

    test('should delay for a while if needed', () => {
      emulator.updateNetworkConditions(FAST_3G);
      jest.useFakeTimers();
      const headers = new Headers();
      headers.append('content-length', FAST_3G.downloadThroughput.toString());
      emulator.handleResponseInPromise(new Response('', {
        headers,
      }), Date.now());
      expect(setTimeout).toHaveBeenCalled();
      jest.useRealTimers();
    });

    test('should do nothing if it is online', () => {
      emulator.updateNetworkConditions(ONLINE);
      expect(emulator.handleResponseInPromise(new Response(), Date.now())).resolves.toBe(undefined);
    });
  });

  test('simulateOfflineOnXMLHttpRequest', () => {
    const xhr = new XMLHttpRequest();
    const fn = jest.fn();
    xhr.addEventListener('error', fn);
    emulator.simulateOfflineOnXMLHttpRequest(xhr);
    expect(fn).toHaveBeenCalled();
    expect(xhr.status).toBe(0);
  });

  describe('handleEventOfXMLHttpRequest', () => {
    let xhr: WrappedXMLHttpRequest;
    let fn: jest.MockedFunction<() => void>;

    beforeEach(() => {
      jest.useFakeTimers();
      xhr = new XMLHttpRequest() as unknown as WrappedXMLHttpRequest;
      xhr.xhrInfo = {
        startTimestamp: Date.now(),
      } as unknown as WrappedXMLHttpRequest['xhrInfo'];
      fn = jest.fn();
    });

    afterEach(() => {
      jest.useRealTimers();
      xhr = null;
      fn = null;
    });

    each([
      'abort',
      'error',
      'timeout',
      'other',
    ]).test('should do nothing for event %s', (eventName) => {
      xhr.addEventListener(eventName, fn);
      emulator.handleEventOfXMLHttpRequest(xhr, new Event(eventName));
      expect(setTimeout).not.toHaveBeenCalled();
      expect(fn).not.toHaveBeenCalled();
    });

    each([
      'loadstart',
      'loadend',
      'load',
    ]).test('should delay event %s', (eventName) => {
      emulator.updateNetworkConditions(FAST_3G);
      xhr.addEventListener(eventName, fn);
      const event = new ProgressEvent(eventName, { loaded: 0, lengthComputable: true, total: FAST_3G.downloadThroughput });
      emulator.handleEventOfXMLHttpRequest(xhr, event);
      expect(setTimeout).toHaveBeenCalled();
      expect(fn).not.toHaveBeenCalled();
      jest.runAllTimers();
      expect(fn).toHaveBeenCalled();
    });

    each([
      'loadstart',
      'loadend',
      'load',
    ]).test('should do nothing if event %s is not computable', (eventName) => {
      emulator.updateNetworkConditions(FAST_3G);
      xhr.addEventListener(eventName, fn);
      const event = new ProgressEvent(eventName, { loaded: 0, lengthComputable: false, total: FAST_3G.downloadThroughput });
      emulator.handleEventOfXMLHttpRequest(xhr, event);
      expect(setTimeout).not.toHaveBeenCalled();
      expect(fn).not.toHaveBeenCalled();
    });

    each([
      'loadstart',
      'loadend',
      'load',
    ]).test('should do nothing on event %s if it is online', (eventName) => {
      emulator.updateNetworkConditions(ONLINE);
      xhr.addEventListener(eventName, fn);
      const event = new ProgressEvent(eventName, { loaded: 0, lengthComputable: true, total: FAST_3G.downloadThroughput });
      emulator.handleEventOfXMLHttpRequest(xhr, event);
      expect(setTimeout).not.toHaveBeenCalled();
      expect(fn).not.toHaveBeenCalled();
    });

    describe('readystatechange', () => {
      let event: Event;

      beforeEach(() => {
        event = new Event('readystatechange');
        Object.defineProperty(xhr, 'readyState', {
          value: 4,
          configurable: true,
          writable: true,
          enumerable: false,
        });
      });

      afterEach(() => {
        event = null;
      });

      test('should do nothing for ready state is not 4', () => {
        Object.defineProperty(xhr, 'readyState', {
          value: 3,
          configurable: true,
          writable: true,
          enumerable: false,
        });
        emulator.handleEventOfXMLHttpRequest(xhr, event);
        expect(setTimeout).not.toHaveBeenCalled();
        expect(fn).not.toHaveBeenCalled();
      });

      test('should throw error when it is offline', () => {
        xhr.addEventListener('error', fn);
        emulator.updateNetworkConditions(OFFLINE);
        emulator.handleEventOfXMLHttpRequest(xhr, event);
        expect(setTimeout).not.toHaveBeenCalled();
        expect(fn).toHaveBeenCalled();
        expect(xhr.status).toBe(0);
      });

      test('should delay event if needed', () => {
        xhr.addEventListener('readystatechange', fn);
        emulator.updateNetworkConditions(SLOW_3G);
        emulator.handleEventOfXMLHttpRequest(xhr, event);
        expect(setTimeout).toHaveBeenCalled();
        expect(fn).not.toHaveBeenCalled();
        jest.runAllTimers();
        expect(fn).toHaveBeenCalled();
      });

      test('should do nothing if it is online', () => {
        xhr.addEventListener('readystatechange', fn);
        emulator.updateNetworkConditions(ONLINE);
        emulator.handleEventOfXMLHttpRequest(xhr, event);
        expect(setTimeout).not.toHaveBeenCalled();
        expect(fn).not.toHaveBeenCalled();
      });
    });
  });
});
