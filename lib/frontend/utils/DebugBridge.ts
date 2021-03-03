import merge from 'lodash-es/merge';

import { MockMap } from '../domains/network/MockMap';
import { REDUX_MODE_NAMESPACE } from './constant';
import { setRemoteDebuggerOption, removeRemoteDebuggerOption, getRemoteDebuggerOption } from './common';

interface InternalNamespaceMap {
  MockMap?: {
    name: 'MockMap';
    refresh: MockMap['refresh'];
  };
  Redux: {
    name: 'Redux';
    enable(): void;
    disable(): void;
    getStatus(): boolean;
  };
};

interface NamespaceMethods {
  [key: string]: (...args: unknown[]) => unknown;
}

type Namespace = {
  name: string;
} & NamespaceMethods;

interface NamespaceMap {
  [key: string]: Namespace | InternalNamespaceMap[keyof InternalNamespaceMap];
}

/**
 * Connect web app (Debug Target) with code in Remote Debugger
 * Web App <---> DebugBridge <---> DevTool
 */
export class DebugBridge {
  private namespaceMap: InternalNamespaceMap & NamespaceMap;

  constructor() {
    this.namespaceMap = {
      Redux: {
        name: 'Redux',
        enable(): void {
          setRemoteDebuggerOption(REDUX_MODE_NAMESPACE);
        },
        disable(): void {
          removeRemoteDebuggerOption(REDUX_MODE_NAMESPACE);
        },
        getStatus(): boolean {
          return !!getRemoteDebuggerOption(REDUX_MODE_NAMESPACE);
        },
      },
    };
  }

  /**
   * Register a bunch of methods to a namespace
   */
  addNamespace(name: keyof InternalNamespaceMap, methods: Partial<InternalNamespaceMap[keyof InternalNamespaceMap]>): void
  addNamespace(name: string, methods: NamespaceMethods): void {
    this.namespaceMap[name] = merge(this.namespaceMap[name] || {}, {
      name,
      ...methods,
    }) as Namespace;
  }

  /**
   * Remove a namespace
   */
  removeNamespace(name: string): void {
    delete this.namespaceMap[name];
  }

  /**
   * Execute namespace method.
   * It's used by code in DevTools to respond to user actions or retrieve information from target web app
   */
  execute(namespaceName: string, methodName: string, ...args: unknown[]): Promise<unknown> {
    const namespace = this.namespaceMap[namespaceName] as Namespace;
    if (!namespace) {
      return Promise.reject(new Error(`No namespace '${namespaceName}'`));
    }
    const method = namespace[methodName];
    if (!method) {
      return Promise.reject(new Error(`No method '${methodName}' in namespace '${namespaceName}'`));
    }

    try {
      return Promise.resolve(method.apply(namespace, args));
    } catch (ex) {
      console.error(ex);
      return Promise.reject(new Error(`Exception in method '${methodName}' in namespace '${namespaceName}': ${ex.toString()}`));
    }
  }

  destroy(): void {
    this.namespaceMap = null;
  }
}
