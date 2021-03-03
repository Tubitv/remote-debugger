import Protocol from 'devtools-protocol';
import NodeURL from 'url';
import http from 'http';

export function hasGzipEncoding(req: Pick<Protocol.Network.Request, 'headers'>): boolean {
  return typeof req.headers['accept-encoding'] === 'string' &&
    req.headers['accept-encoding'].includes('gzip');
}

export function getDomain(url: Pick<NodeURL.UrlWithStringQuery, 'host'>): string {
  return url.host
    .split('.')
    .slice(-2)
    .join('.');
}

export function getRequestIp(req: Pick<http.IncomingMessage, 'headers' | 'connection'>): string {
  const ips = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  return Array.isArray(ips) ? ips[0] : ips;
}
