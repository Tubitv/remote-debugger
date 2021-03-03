import RemoteDebugger from 'frontend/remoteDebugger';
import Cookie from 'js-cookie';
import Protocol from 'devtools-protocol';

export class CookieManager {
  constructor(private remoteDebugger: RemoteDebugger) {
    remoteDebugger.socket.on('Network.getCookies', this.getCookies);
    remoteDebugger.socket.on('Network.setCookie', this.setCookie);
    remoteDebugger.socket.on('Network.deleteCookies', this.deleteCookies);
  }

  destroy(): void {}

  deleteCookies = ({ name }: Protocol.Network.DeleteCookiesRequest): void => {
    Cookie.remove(name);
    this.remoteDebugger.emit('Network.deleteCookies-response', true);
  }

  getCookies = (): void => {
    const cookieMap = Cookie.get();
    const cookieList: Protocol.Network.Cookie[] = Object.entries(cookieMap).map(([name, value]) => ({
      name,
      value,
      domain: location.host,
      path: '/',
      expires: 0,
      size: value.toString.length,
      httpOnly: false,
      secure: false,
      session: false,
    } as Protocol.Network.Cookie));
    this.remoteDebugger.emit('Network.getCookies-response', { cookies: cookieList });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setCookie = ({ name, value, sameSite, ...options }: Protocol.Network.SetCookieRequest): void => {
    Cookie.set(name, value, options);
  }
}
