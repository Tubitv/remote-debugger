const currentScript = document.createElement('script');

Object.defineProperty(document, 'currentScript', {
  configurable: true,
  writable: true,
  enumerable: false,
  value: currentScript,
});

/**
 * Jest Fetch Mock allows you to easily mock your fetch calls and return the response you need to fake the HTTP requests.
 * It's easy to setup and you don't need a library like nock to get going and it uses Jest's built-in support for mocking under the surface.
 */
require('jest-fetch-mock').enableMocks();
