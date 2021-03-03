/* eslint-disable import/first */
import 'core-js/stable';
import 'es6-promise/auto';
import '@webcomponents/url'; // polyfill for window.URL, particularly URL.createObjectURL().

import Cookie from 'js-cookie';
import { v4 as uuidV4 } from 'uuid';
import EventEmitter from 'events';
import { RemoteDebuggerLifecycleEvent } from 'typings/common';

import registerPolyfills from './utils/polyfills';
import { RemoteDebugger, DebuggerStatus } from './remoteDebugger';
import { composeWithDevTools } from './domains/redux/devTools';

declare global {
  interface Window {
    remoteDebuggerLauncher: RemoteDebuggerLauncher;
    REMOTE_DEBUGGER_SCRIPT_URL?: string;
  }
}

registerPolyfills();

const NAME_SPACE_FOR_UUID = 'remote_debugger_uuid';

type RemoteDebuggerLauncherStatus = {
  enabled: boolean;
} & Partial<DebuggerStatus>;

/**
 * set Promise polyfill if not existent
 * (required for webdriver executeAsync command)
 */
// @ts-ignore
if (!window.Promise) {
  // @ts-ignore
  window.Promise = Promise;
}

export class RemoteDebuggerLauncher extends EventEmitter {
  remoteDebugger?: RemoteDebugger;
  private currentScript: HTMLScriptElement;
  devToolsBackendHost: string;
  private devToolsBackendProtocol: string;
  private devToolsBackendOrigin: string;
  uuid: string;

  constructor() {
    super();
    this.setCurrentScript();
    this.setScriptInfo();
    this.setUUID();
  }

  get enabled(): boolean {
    return !!this.remoteDebugger;
  }

  get composeWithDevTools(): (...funcs: unknown[]) => (...args: unknown[]) => unknown {
    return composeWithDevTools;
  }

  get debugBridge(): RemoteDebugger['debugBridge'] | void {
    return this.remoteDebugger && this.remoteDebugger.debugBridge;
  }

  getDebugBridge(): RemoteDebugger['debugBridge'] | void {
    return this.debugBridge;
  }

  enable(): void {
    try {
      this.remoteDebugger = new RemoteDebugger(this, this.uuid, this.devToolsBackendOrigin);
      this.emitLifecycleEvent('create');
    } catch (error) {
      console.error(
        'Something went wrong connecting to the remote debugger:',
        error
      );
      this.emitLifecycleEvent('create_error');
    }
  }

  disable(): void {
    if (this.enabled) {
      this.remoteDebugger.destroy();
      delete this.remoteDebugger;
    }
    this.emitLifecycleEvent('destroy');
  }

  emitLifecycleEvent(name: RemoteDebuggerLifecycleEvent): void {
    this.emit(name);
    /**
     * The user doesn't know when does the remote debugger finish loading,
     * so we expose the create-related event to the window scope.
     */
    if (name.startsWith('create')) {
      window.dispatchEvent(new Event('remoteDebuggerCreated'));
    }
  }

  async getStatus(): Promise<RemoteDebuggerLauncherStatus> {
    if (!this.enabled) {
      return {
        enabled: false,
      };
    }
    const status = await this.remoteDebugger.getDebuggerStatus();
    return {
      enabled: true,
      ...status,
    };
  }

  toggle(): void {
    if (this.enabled) {
      this.disable();
    } else {
      this.enable();
    }
  }

  private setCurrentScript(): void {
    if (document.currentScript) {
      this.currentScript = document.currentScript as HTMLScriptElement;
      return;
    }
    const scripts = Array.from(document.querySelectorAll('script'));
    this.currentScript = scripts.find((script) => {
      const src = script.getAttribute('src');
      if (!src) {
        return false;
      }
      return src.includes(window.REMOTE_DEBUGGER_SCRIPT_URL || 'launcher.js');
    });
  }

  private setScriptInfo(): void {
    const [devToolsBackendProtocol, devToolsBackendHost] = this.currentScript.src.split(/\/{1,2}/);
    this.devToolsBackendHost = devToolsBackendHost;
    this.devToolsBackendProtocol = devToolsBackendProtocol;
    this.devToolsBackendOrigin = `${this.devToolsBackendProtocol}//${this.devToolsBackendHost}`;
  }

  private setUUID(): void {
    let uuid = this.currentScript.getAttribute('data-uuid') ||
      localStorage?.getItem(NAME_SPACE_FOR_UUID) ||
      Cookie.get(NAME_SPACE_FOR_UUID);
    if (!uuid) {
      uuid = uuidV4();
      try {
        localStorage.setItem(NAME_SPACE_FOR_UUID, uuid);
      } catch (ex) {
        Cookie.set(NAME_SPACE_FOR_UUID, uuid);
      }
    }
    this.uuid = uuid;
  }
}

export const remoteDebuggerLauncher = new RemoteDebuggerLauncher();

// We don't auto-enable under test env. That will interfere with our test.
if (!__TESTING__) {
  window.remoteDebuggerLauncher = remoteDebuggerLauncher;
  window.remoteDebuggerLauncher.enable();
}
