import IO from 'socket.io';
import http from 'http';
import IOClient from 'socket.io-client';
import WS from 'ws';

import Page from './page';
import { waitUntilSocketEvent, getUniquePort } from '../test/tool';
import { FAKE_REGISTER_PAGE_INFO } from '../test/constant';
import { LOCALHOST } from '../constants';

describe('backend/page', () => {
  let io: SocketIO.Server;
  let targetSocket: SocketIOClient.Socket;
  let serverTargetSocket: SocketIO.Socket;
  let targetServer: http.Server;
  let clientServer: http.Server;
  let clientSocket: WS;
  let serverClientSocket: WS;
  let wss: WS.Server;
  let page: Page;
  const targetPort = getUniquePort();
  const clientPort = getUniquePort(4000);

  beforeEach(async () => {
    jest.useFakeTimers();
    targetServer = http.createServer().listen(targetPort, LOCALHOST);
    io = IO(targetServer, {
      pingTimeout: 10,
      pingInterval: 10,
    });
    targetSocket = IOClient(`http://${LOCALHOST}:${targetPort}`);
    serverTargetSocket = await waitUntilSocketEvent(io, 'connect');
    page = new Page(FAKE_REGISTER_PAGE_INFO, serverTargetSocket);
    clientServer = http.createServer().listen(clientPort, LOCALHOST);
    wss = new WS.Server({ server: clientServer });
    clientSocket = new WS(`http://${LOCALHOST}:${clientPort}`);
    const [scs] = await Promise.all([
      waitUntilSocketEvent(wss, 'connection'),
      waitUntilSocketEvent(clientSocket, 'open'),
    ]);
    serverClientSocket = scs as WS;
  });

  afterEach(() => {
    serverClientSocket.close();
    wss.removeAllListeners();
    wss.close();
    clientServer.close();
    serverTargetSocket.disconnect();
    io.close();
    targetServer.close();
    targetSocket.close();
    jest.useRealTimers();
  });

  test('should connect to the target when the page is created', () => {
    expect(page.isConnectedToTarget).toBe(true);
    expect(page.isConnectedToClient).toBe(false);
  });

  test('should trigger the target disconnect logic when the target disconnects', async () => {
    targetSocket.disconnect();
    await waitUntilSocketEvent(serverTargetSocket, 'disconnect');
    expect(page.isConnectedToTarget).toBe(false);
  });

  test('connectClient() should connect the page to the target and the client', () => {
    page.connectClient('', serverClientSocket);
    expect(page.isConnectedToTarget).toBe(true);
    expect(page.isConnectedToClient).toBe(true);
  });

  test('should trigger the client disconnect logic when the client disconnects', async () => {
    page.connectClient('', serverClientSocket);
    const closePromise = waitUntilSocketEvent(serverClientSocket, 'close');
    clientSocket.close();
    await closePromise;
    expect(page.isConnectedToTarget).toBe(true);
    expect(page.isConnectedToClient).toBe(false);
  });

  test('should pass the information from the target to the client', async () => {
    const data = { method: 'Network.requestWillBeSent', params: {} };
    page.connectClient('', serverClientSocket);
    const messagePromise = waitUntilSocketEvent(clientSocket, 'message');
    targetSocket.emit('result', data);
    const event = await messagePromise;
    expect(JSON.parse(event)).toEqual(data);
  });

  test('getStatus should send the data', (done) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    page.getStatus((data: any) => {
      expect(data).toMatchObject({
        isConnectedToClient: false,
        isConnectedToTarget: true,
      });
      done();
    });
  });
});
