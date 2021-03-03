import Protocol from 'devtools-protocol';

export type RemoteDebuggerLifecycleEvent = | 'create'
  | 'destroy'
  | 'ready'
  | 'create_timeout'
  | 'create_error'
  | 'server_connect'
  | 'server_disconnect'
  | 'server_reconnect'
  | 'server_connect_timeout'
  | 'server_connect_error'
  | 'server_reconnecting'
  | 'server_reconnect_failed'
  | 'server_page_registered';

export interface ExecuteCommandPayloadTypes {
  'Network.requestWillBeSent': Protocol.Network.RequestWillBeSentEvent;
  'Network.responseReceived': Protocol.Network.ResponseReceivedEvent;
  'Network.dataReceived': Protocol.Network.DataReceivedEvent;
  'Network.loadingFinished': Protocol.Network.LoadingFinishedEvent;
  'Network.loadingFailed': Protocol.Network.LoadingFailedEvent;
}

export type DomainName = | 'CSS'
  | 'DOM'
  | 'Debugger'
  | 'Input'
  | 'Network'
  | 'Overlay'
  | 'Page'
  | 'Runtime'
  | 'Target'
  | 'Webdriver'
  | 'Redux'
  | 'Log'
  | 'DOMStorage';
type DomainEventPayloadType = Record<DomainName, unknown>;

type SocketEventName = | 'connect'
  | 'connect_error'
  | 'connect_timeout'
  | 'connecting'
  | 'disconnect'
  | 'error'
  | 'reconnect'
  | 'reconnect_attempt'
  | 'reconnect_failed'
  | 'reconnect_error'
  | 'reconnecting'
  | 'ping'
  | 'pong';

type SocketEventPayloadType = Record<SocketEventName, unknown>;

export interface Metadata {
  appName: string;
  appCodeName: string;
  appVersion: string;
  product: string;
  platform: string;
  vendor: string;
  userAgent: string;
}

export interface WebSocketMessage {
  id?: string;
  result?: unknown;
  _domain?: string;
  _method?: keyof ExecuteCommandPayloadTypes | string;
  method?: keyof ExecuteCommandPayloadTypes | string;
  params?: ExecuteCommandPayloadTypes[keyof ExecuteCommandPayloadTypes] | unknown;
  error?: { message: string };
};

interface NormalSocketStatus {
  isConnectedToClient: boolean;
  isConnectedToTarget: boolean;
  clientIp: string;
  targetConnectionDuration: number;
}

interface FailedSocketStatus {
  timeout: boolean;
}

export type SocketStatus = NormalSocketStatus | FailedSocketStatus;

export interface TargetToClientEventPayloadTypes {
  connection: {
    status: 'established';
    supportedDomains: DomainName[];
    info: {
      url: string;
      description: string;
      title: string;
      frameId: string;
      metadata: Metadata;
    };
  };
  disconnect: string;
  debug: string | { message: string; stack: string[] };
  log: unknown[];
  getStatus: (data: SocketStatus) => void;
  'error:injectScript': Error;
  'Network.getResponseBody-response': Protocol.Network.GetResponseBodyResponse & { uuid: string };
  'Network.getCookies-response': Protocol.Page.GetCookiesResponse;
  'Network.deleteCookies-response': boolean;
  result: WebSocketMessage;
  registerPage: {
    uuid: string;
    url: string;
    description: string;
    title: string;
    deviceId: string;
    frameId: string;
    hostname: string;
    metadata: Metadata;
    supportedDomains: DomainName[];
  };
}

interface CustomClientToTargetEventPayloadTypes {
  'Network.getResponseBody': Protocol.Network.GetResponseBodyRequest & { uuid: string };
  'Network.getCookies': Protocol.Network.GetCookiesRequest;
  'Network.setCookie': Protocol.Network.SetCookieRequest;
  'Network.deleteCookies': Protocol.Network.DeleteCookiesRequest;
  'Network.emulateNetworkConditions': Protocol.Network.EmulateNetworkConditionsRequest;
  pageRegistered: void;
}

export type ClientToTargetEventPayloadTypes = CustomClientToTargetEventPayloadTypes & DomainEventPayloadType & SocketEventPayloadType;

/* eslint-disable @typescript-eslint/no-namespace, @typescript-eslint/adjacent-overload-signatures */
declare global {
  namespace SocketIO {
    interface Socket {
      on<T extends keyof TargetToClientEventPayloadTypes>(event: T, listener: (result: TargetToClientEventPayloadTypes[T]) => void): this;
      once<T extends keyof TargetToClientEventPayloadTypes>(event: T, listener: (result: TargetToClientEventPayloadTypes[T]) => void): this;
      emit<T extends keyof ClientToTargetEventPayloadTypes>(type: T, ...args: ClientToTargetEventPayloadTypes[T] extends undefined ? [] : [ClientToTargetEventPayloadTypes[T]]): boolean;
    }
  }
  namespace SocketIOClient {
    interface Socket {
      on<T extends keyof ClientToTargetEventPayloadTypes>(event: T, listener: (result: ClientToTargetEventPayloadTypes[T]) => void): this;
      once<T extends keyof ClientToTargetEventPayloadTypes>(event: T, listener: (result: ClientToTargetEventPayloadTypes[T]) => void): this;
      emit<T extends keyof TargetToClientEventPayloadTypes>(type: T, ...args: [TargetToClientEventPayloadTypes[T]]): this;
    }
  }

  namespace SocketIOClient {
    interface Emitter {
      on<T extends keyof ClientToTargetEventPayloadTypes>(event: T, listener: (...args: [ClientToTargetEventPayloadTypes[T]]) => void): this;
    }
  }
}
/* eslint-enable @typescript-eslint/no-namespace, @typescript-eslint/adjacent-overload-signatures */
