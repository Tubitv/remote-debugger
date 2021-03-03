import xhr, { XhrResponse } from 'xhr';
import Cookie from 'js-cookie';

import { REMOTE_DEBUGGER_OPTIONS_NAMESPACE, REDUX_MODE_NAMESPACE } from './constant';

const flatten = <T>(arr: T[]): T[] =>
  arr.reduce(
    (acc: T[], val) => acc.concat(Array.isArray(val) ? flatten(val) : val),
    []
  );

export function getAttributes(namedNodeMap: Element['attributes']): void | string[] {
  /**
   * ensure text nodes aren't accidentely being parsed for attributes
   */
  if (!namedNodeMap) {
    return;
  }

  const attributes = Array.prototype.slice
    .call(namedNodeMap)
    .map((attr: { name: string; value: string}) => [attr.name, attr.value]);
  return flatten<string>(attributes);
}

export function getTitle(): string {
  /**
   * get document title
   */
  let title = '';
  const titleTag = document.querySelector('title');
  if (titleTag) {
    title = titleTag.text;
  }

  return title;
}

export function getDescription(): string {
  /**
   * get document description
   */
  let description = '';
  const metaTags = document.querySelectorAll('meta');
  for (let i = 0; i < metaTags.length; ++i) {
    const tag = metaTags[i];
    if (tag.getAttribute('name') !== 'description') {
      continue;
    }

    description = tag.getAttribute('content');
  }

  return description;
}

/**
 * simple wrapper to do POST request with XHR
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function request(url: string, json: any): Promise<XhrResponse> {
  return new Promise((resolve, reject) => {
    xhr.post(
      {
        url,
        json,
        timeout: 15000,
        headers: { 'Content-Type': 'application/json' },
      },
      (err, res) => {
        if (err) {
          return reject(err);
        }
        const resolveProto = Object.getPrototypeOf(resolve);
        console.log('typeof resolve: ', typeof resolve, ', constructor:', resolveProto && resolveProto.constructor);
        console.dir(resolve);
        console.dir(reject);
        return resolve(res);
      }
    );
  });
}

export function filterDupName(cssText: string): string {
  // add semicolon after commented declarations
  const pieces = cssText.replace(/([\s\S]*)\*\//, '$1*/;').split(';');
  const firstPiece = pieces[0];
  const result = [firstPiece];
  for (let i = 1; i < pieces.length; i++) {
    let piece = pieces[i];
    // piece: "/* display: none */", firstPiece: "display: none"
    if (piece.match(firstPiece)) {
      piece = piece.replace(firstPiece, '').replace(/\/\*\s*\*\//g, '');
    }
    // if piece: "display: none", firstPiece: "/* display: none */", ignore piece
    if (!firstPiece.match(piece)) {
      result.push(piece);
    }
  }

  // remove semicolon after commented declarations
  return result.join(';').replace(/\*\/;/, '*/');
}

export function getPropertiesByCSSText(cssText: string): { name: string; value: string }[] {
  const match = cssText.match('.*{(.*)}.*');
  if (!match) return [];

  const parts = match[1].trim().split(';');
  return parts.filter(Boolean).map(function(part) {
    const pairs = part.split(':');
    return {
      name: pairs[0].trim(),
      value: pairs[1].trim(),
    };
  });
}

type RemoteDebuggerOptions = {
  [REDUX_MODE_NAMESPACE]: true;
  [name: string]: true;
}

function getRemoteDebuggerOptions(): RemoteDebuggerOptions {
  return (JSON.parse(Cookie.get(REMOTE_DEBUGGER_OPTIONS_NAMESPACE) || '{}')) as RemoteDebuggerOptions;
}

export function getRemoteDebuggerOption(type: string): boolean | void {
  return getRemoteDebuggerOptions()[type];
}

export function setRemoteDebuggerOption(type: string): void {
  const options = getRemoteDebuggerOptions();
  options[type] = true;
  Cookie.set(REMOTE_DEBUGGER_OPTIONS_NAMESPACE, JSON.stringify(options));
}

export function removeRemoteDebuggerOption(type: string): void {
  const options = getRemoteDebuggerOptions();
  delete options[type];
  Cookie.set(REMOTE_DEBUGGER_OPTIONS_NAMESPACE, JSON.stringify(options));
}

export function isSupportWorker(): boolean {
  return typeof Worker !== 'undefined';
}
