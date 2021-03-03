import Protocol from 'devtools-protocol';

const getStorage = (isLocalStorage: boolean): Storage => {
  return isLocalStorage ? window.localStorage : window.sessionStorage;
};

export function getDOMStorageItems({ storageId }: Protocol.DOMStorage.GetDOMStorageItemsRequest): Protocol.DOMStorage.GetDOMStorageItemsResponse {
  const storage = getStorage(storageId.isLocalStorage);
  const entries = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    const value = storage.getItem(key);
    entries.push([key, value]);
  }
  return { entries };
}

export function setDOMStorageItem({ key, value, storageId }: Protocol.DOMStorage.SetDOMStorageItemRequest): void {
  const storage = getStorage(storageId.isLocalStorage);
  storage.setItem(key, value);
}

export function removeDOMStorageItem({ key, storageId }: Protocol.DOMStorage.RemoveDOMStorageItemRequest): void {
  const storage = getStorage(storageId.isLocalStorage);
  storage.removeItem(key);
}

export function clear({ storageId }: Protocol.DOMStorage.ClearRequest): void {
  const storage = getStorage(storageId.isLocalStorage);
  storage.clear();
}
