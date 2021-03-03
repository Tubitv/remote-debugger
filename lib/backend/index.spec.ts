import http from 'http';
import IO from 'socket.io';
import IOClient from 'socket.io-client';

import Backend from './index';
import { FAKE_REGISTER_PAGE_INFO } from '../test/constant';
import { getUniquePort } from '../test/tool';
import { LOCALHOST } from '../constants';

describe('Backend', () => {
  let io: SocketIO.Server;
  let targetSocket: SocketIOClient.Socket;
  let serverTargetSocket: SocketIO.Socket;
  let targetServer: http.Server;
  let backend: Backend;
  const port = getUniquePort();

  beforeEach((done) => {
    jest.useFakeTimers();
    targetServer = http.createServer().listen(port, LOCALHOST);
    io = IO(targetServer, {
      pingTimeout: 10,
      pingInterval: 10,
    });
    backend = new Backend(io);
    io.on('connect', (socket) => {
      serverTargetSocket = socket;
      done();
    });
    targetSocket = IOClient(`http://${LOCALHOST}:${port}`);
  });

  afterEach(() => {
    serverTargetSocket?.disconnect();
    io.close();
    targetServer.close();
    targetSocket.close();
    jest.useRealTimers();
  });

  test('should create page when there is a new target', () => {
    expect(backend.pages).toHaveLength(0);
    backend.bindPageWithTargetSocket(FAKE_REGISTER_PAGE_INFO, serverTargetSocket);
    expect(backend.pages).toHaveLength(1);
  });

  test('should remove page when the page is disconnected', () => {
    backend.bindPageWithTargetSocket(FAKE_REGISTER_PAGE_INFO, serverTargetSocket);
    targetSocket.close();
    jest.runAllTimers();
    expect(backend.pages).toHaveLength(0);
  });

  test('should reuse the page when the socket gets reconnected', () => {
    backend.bindPageWithTargetSocket(FAKE_REGISTER_PAGE_INFO, serverTargetSocket);
    const pagesAfterFirstConnection = backend.pages;
    backend.bindPageWithTargetSocket(FAKE_REGISTER_PAGE_INFO, serverTargetSocket);
    expect(backend.pages).toEqual(pagesAfterFirstConnection);
  });
});
