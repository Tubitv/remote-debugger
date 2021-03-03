import IO from 'socket.io';
import http from 'http';

import { RemoteDebugger } from './remoteDebugger';
import { remoteDebuggerLauncher } from './launcher.bundle';
import { waitUntilLifecycleEvent, getUniquePort } from '../test/tool';
import { LOCALHOST } from '../constants';

describe('RemoteDebugger', () => {
  let io: SocketIO.Server;
  let server: http.Server;
  let remoteDebugger: RemoteDebugger;
  const port = getUniquePort();

  function createRemoteDebugger(port: number): RemoteDebugger {
    return new RemoteDebugger(remoteDebuggerLauncher, '', `http://${LOCALHOST}:${port}`);
  }

  beforeEach(() => {
    server = http.createServer().listen(port, LOCALHOST);
    io = IO(server);
  });

  afterEach(() => {
    remoteDebugger?.destroy();
    io.close();
    server.close();
  });

  describe('socket connection', () => {
    test('should connect to server', async () => {
      const ioConnectFn = jest.fn();
      io.on('connect', ioConnectFn);
      remoteDebugger = createRemoteDebugger(port);
      await waitUntilLifecycleEvent(remoteDebuggerLauncher, 'server_connect');
      expect(ioConnectFn).toHaveBeenCalledTimes(1);
    });

    test('should trigger lifecycle event in normal status', async () => {
      const promise = Promise.all([
        waitUntilLifecycleEvent(remoteDebuggerLauncher, 'ready'),
        waitUntilLifecycleEvent(remoteDebuggerLauncher, 'server_connect'),
      ]);
      remoteDebugger = createRemoteDebugger(port);
      await promise;
    });

    test('should trigger lifecycle event when disconnect', async () => {
      remoteDebugger = createRemoteDebugger(port);
      await waitUntilLifecycleEvent(remoteDebuggerLauncher, 'server_connect');
      server.close();
      await waitUntilLifecycleEvent(remoteDebuggerLauncher, 'server_disconnect');
    });

    test('should register page when connected', (done) => {
      io.on('connect', socket => {
        socket.once('registerPage', () => {
          socket.disconnect();
          done();
        });
      });
      remoteDebugger = createRemoteDebugger(port);
    });
  });

  describe('API', () => {
    test('getDebuggerStatus should provide proper info', async () => {
      let serverSocket: SocketIO.Socket;
      io.on('connect', socket => {
        serverSocket = socket;
      });
      remoteDebugger = createRemoteDebugger(port);
      const statusResponse = {
        isConnectedToClient: false,
        isConnectedToTarget: true,
        clientIp: '',
        targetConnectionDuration: 100,
      };
      await waitUntilLifecycleEvent(remoteDebuggerLauncher, 'server_connect');
      serverSocket.on('getStatus', (callback) => {
        callback(statusResponse);
      });
      const status = await remoteDebugger.getDebuggerStatus();
      expect(status).toMatchObject({
        serverConnected: true,
        ...statusResponse,
      });
      serverSocket.disconnect();
    });

    test('getDebuggerStatus should provide proper info even when disconnected', (done) => {
      let serverSocket: SocketIO.Socket;
      io.on('connect', async socket => {
        serverSocket = socket;
        serverSocket.disconnect();
        const status = await remoteDebugger.getDebuggerStatus();
        expect(status).toMatchObject({
          serverConnected: false,
        });
        done();
      });
      remoteDebugger = createRemoteDebugger(port);
    });
  });
});
