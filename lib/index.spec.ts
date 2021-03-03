import IOClient from 'socket.io-client';
import WS from 'ws';

import DevToolsBackend, { DEFAULT_HOST } from './index';
import { FAKE_REGISTER_PAGE_INFO } from './test/constant';
import { getUniquePort } from './test/tool';

describe('root server', () => {
  let server: DevToolsBackend;
  const port = getUniquePort();
  beforeEach(() => {
    jest.useFakeTimers();
    server = new DevToolsBackend(DEFAULT_HOST, port);
  });

  afterEach(() => {
    server.close();
    jest.useRealTimers();
  });

  test('should pass the information from the target side to the client side', (done) => {
    const targetSocket = IOClient(`http://${DEFAULT_HOST}:${port}`);
    targetSocket.on('connect', () => {
      targetSocket.emit('registerPage', FAKE_REGISTER_PAGE_INFO);
    });
    targetSocket.on('pageRegistered', () => {
      const data = { method: 'Debugger.scriptParsed', params: {} };
      targetSocket.emit('result', data);
      const clientSocket = new WS(`http://${DEFAULT_HOST}:${port}/devtools/page/${FAKE_REGISTER_PAGE_INFO.uuid}`);
      targetSocket.emit('test');
      clientSocket.on('open', () => {
        const fn = jest.fn();
        clientSocket.addEventListener('message', (e) => {
          fn();
          const result = JSON.parse(e.data);
          if (result.method === data.method) {
            expect(result).toMatchObject(data);
            expect(fn).toHaveBeenCalledTimes(2);
            targetSocket.close();
            clientSocket.close();
            jest.runOnlyPendingTimers();
            done();
          }
        });
      });
    });
  });
});
