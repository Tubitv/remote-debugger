import RemoteDebugger from 'frontend/remoteDebugger';
import { TargetToClientEventPayloadTypes } from 'typings/common';

import { getBase64FromBlob, isImageResponse } from './tools';

type LegalResponse =
  | Response
  | {
      body: string;
      responseType: XMLHttpRequest['responseType'];
      base64Encoded?: boolean;
    };

export class ResponseMap {
  private map: { [id: string]: LegalResponse };
  private timer: number;
  private remoteDebugger: RemoteDebugger;

  constructor(remoteDebugger: RemoteDebugger) {
    this.map = {};
    this.remoteDebugger = remoteDebugger;
  }

  destroy(): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = null;
    this.map = null;
  }

  async getResponseBody(id: string, uuid: string): Promise<void> {
    const response = this.map[id];
    if (!response) {
      return;
    }
    if (response instanceof Response) {
      const cloneResponse = response.clone();
      const result: TargetToClientEventPayloadTypes['Network.getResponseBody-response'] = {
        base64Encoded: false,
        body: '',
        uuid,
      };
      if (isImageResponse(cloneResponse)) {
        const blob = await cloneResponse.blob();
        const base64 = await getBase64FromBlob(blob);
        result.body =
          typeof base64 === 'string' ? base64.replace(/data.+base64,/, '') : '';
        result.base64Encoded = true;
      } else {
        const text = await cloneResponse.text();
        result.body = text;
      }
      this.remoteDebugger.emit('Network.getResponseBody-response', result);
    } else {
      this.remoteDebugger.emit('Network.getResponseBody-response', {
        body: response.body,
        base64Encoded: !!response.base64Encoded,
        uuid,
      });
    }
    delete this.map[id];
  }

  set(id: string, value: LegalResponse, method: string): void {
    const isGet = method === 'GET';
    const isImage = value instanceof Response
      ? isImageResponse(value)
      : !!value.base64Encoded;
    // We don't store the image on the target side.
    // It is too big.
    if (isGet && isImage) {
      return;
    }
    this.map[id] = value;
    this.garbageCollection();
  }

  private garbageCollection(): void {
    if (this.timer) {
      return;
    }
    // @ts-ignore
    this.timer = setTimeout(() => {
      const keys = Object.keys(this.map);
      if (keys.length > 10) {
        const keysToDelete = keys
          .sort((a, b) => parseInt(b, 10) - parseInt(a, 10))
          .slice(10);
        keysToDelete.forEach(key => {
          delete this.map[key];
        });
      }
    }, 1000);
  }
}
