import ws from 'ws';

import { RemoteDebuggerLifecycleEvent } from 'typings/common';

import { RemoteDebuggerLauncher } from 'frontend/launcher.bundle';

export function waitUntilLifecycleEvent(launcher: RemoteDebuggerLauncher, event: RemoteDebuggerLifecycleEvent): Promise<void> {
  return new Promise((resolve): void => {
    const resolveWithUndefined = (): void => {
      launcher.removeListener(event, resolveWithUndefined);
      resolve();
    };
    launcher.addListener(event, resolveWithUndefined);
  });
}

export function waitUntilSocketEvent(socket: ws.Server, name: 'connection'): Promise<ws>;
export function waitUntilSocketEvent(socket: SocketIO.Server, name: 'connect'): Promise<SocketIO.Socket>;
export function waitUntilSocketEvent(socket: SocketIOClient.Socket | SocketIO.Socket | SocketIO.Server, name: 'message'): Promise<MessageEvent>;
export function waitUntilSocketEvent(socket: ws | ws.Server, name: 'message'): Promise<string>;
export function waitUntilSocketEvent(socket: SocketIOClient.Socket | SocketIO.Socket | ws | ws.Server | SocketIO.Server, name: string): Promise<MessageEvent | SocketIO.Socket | ws>;
export function waitUntilSocketEvent(socket: SocketIOClient.Socket | SocketIO.Socket | ws | ws.Server | SocketIO.Server, name: string): Promise<MessageEvent | SocketIO.Socket | ws | string> {
  return new Promise((resolve) => {
    // @ts-ignore: It need us to add some logic to add once listener for each socket. Will do this if I have time
    socket.once(name, resolve);
  });
}

// TODO: We may need to use the code in the comment to get the real unique port. https://github.com/facebook/jest/issues/2284#issuecomment-338856327
export function getUniquePort(base = 3000): number {
  return base + parseInt(process.env.JEST_WORKER_ID);
}
