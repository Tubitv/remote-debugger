import Protocol from 'devtools-protocol';

import { hasGzipEncoding } from './utils';

const asNetRequest = (obj: unknown): Protocol.Network.Request => obj as Protocol.Network.Request;

test('hasGzipEncoding()', () => {
  expect(hasGzipEncoding(asNetRequest({ headers: {} }))).toBe(false);
  expect(hasGzipEncoding(asNetRequest({ headers: { 'accept-encoding': false } }))).toBe(false);
  expect(hasGzipEncoding(asNetRequest({ headers: { 'accept-encoding': 'none' } }))).toBe(false);
  expect(hasGzipEncoding(asNetRequest({ headers: { 'accept-encoding': 'somegzip' } }))).toBe(true);
});
