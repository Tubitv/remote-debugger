import RemoteDebugger from 'frontend/remoteDebugger';

import { init, restore } from './xhr';
import { ResponseMap } from './ResponseMap';
import { MockMap } from './MockMap';
import { Emulator } from './Emulator';

const methods: ['open', 'send', 'setRequestHeader'] = ['open', 'send', 'setRequestHeader'];

describe('frontend/domains/network/xhr', () => {
  afterEach(() => {
    restore();
  });

  test('restore should change all back to normal', () => {
    const originXHR = XMLHttpRequest;
    init(
      {} as unknown as RemoteDebugger,
      {} as unknown as ResponseMap,
      {} as unknown as MockMap,
      {} as unknown as Emulator
    );
    restore();
    expect(originXHR).toBe(XMLHttpRequest);
    methods.forEach(method => {
      expect(originXHR.prototype[method]).toBe(XMLHttpRequest.prototype[method]);
    });
  });

  test('init should change XMLHttpRequest', () => {
    const originXHR = XMLHttpRequest;
    init(
      {} as unknown as RemoteDebugger,
      {} as unknown as ResponseMap,
      {} as unknown as MockMap,
      {} as unknown as Emulator
    );
    expect(originXHR).not.toBe(XMLHttpRequest);
    methods.forEach(method => {
      expect(originXHR.prototype[method]).not.toBe(XMLHttpRequest.prototype[method]);
    });
  });
});
