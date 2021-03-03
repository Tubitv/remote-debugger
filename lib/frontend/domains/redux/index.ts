import RemoteDebugger from 'frontend/remoteDebugger';

import { DevToolsEnhancer } from './devTools';

export function init(remoteDebugger: RemoteDebugger): void {
  DevToolsEnhancer.setRemoteDebugger(remoteDebugger);
}
