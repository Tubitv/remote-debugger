const enabled = false;
const name = 'Page';

/**
 * Reloads given page optionally ignoring the cache.
 *
 * @param  {Boolean} ignoreCache If true, browser cache is ignored (as if the user pressed Shift+refresh).
 */
export function reload({ ignoreCache }) {
  window.location.reload(Boolean(ignoreCache));
  return {};
}

/**
 * Navigates current page to the given URL.
 *
 * @param  {String} url  URL to navigate the page to.
 */
export function navigate({ url }) {
  if (typeof url !== 'string') {
    return;
  }

  window.location.assign(url);
  return {};
}

/**
 * Navigates current page to the given history entry.
 *
 * @param  {Integer}  Unique id of the entry to navigate to.
 */
export function navigateToHistoryEntry({ entryId }) {
  window.history.go(entryId);
  return {};
}

/**
 * Information about the Frame hierarchy along with their cached resources.
 * @return {Object} frame tree
 */
export function getResourceTree() {
  return {
    frameTree: {
      childFrames: [],
      frame: {
        id: this.frameId,
        loaderId: this.frameId + '0', // ToDo add loader
        mimeType: 'text/html',
        securityOrigin: document.location.origin,
        url: document.location.origin,
      },
      resources: [],
    },
  };
}

/**
 * Controls whether browser will open a new inspector window for connected pages.
 *
 * @param {Boolean} autoAttach  If true, browser will open a new inspector window for
 *                              every page created from this one.
 */
export function setAutoAttachToCreatedPages({ autoAttach }) {
  return {};
}

/**
 * Events
 */

/**
 * Fired when frame has stopped loading.
 */
export function frameStoppedLoading() {
  this.execute('Page.frameStoppedLoading', { frameId: this.frameId });
}

export function loadEventFired() {
  this.execute('Page.loadEventFired', { timestamp: Date.now() / 1000 });
}

export function getNavigationHistory() {}

export function setAdBlockingEnabled() {}

export function startScreencast() {
  return {};
}

export function stopScreencast() {
  return {};
}

export { name, enabled };
