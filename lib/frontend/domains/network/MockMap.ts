import RemoteDebugger from 'frontend/remoteDebugger';

interface MapFrom {
  stringSlice?: string;
  disabled?: boolean;
}

interface MapTo {
  url?: string;
}

type MockArray = [MapFrom, MapTo][];

export class MockMap {
  private mockArray: MockArray;
  constructor(private remoteDebugger: RemoteDebugger) {
    this.mockArray = [];
  }

  refresh = ({ mockArray }: { mockArray: MockArray }): void => {
    this.mockArray = mockArray;
    console.log(`The latest mock rules is ${JSON.stringify(this.mockArray, undefined, 4)}`);
  };

  handleRequest(request: string): string;
  handleRequest(request: RequestInfo): RequestInfo;
  handleRequest(request: RequestInfo): RequestInfo {
    for (const [mapFrom, mapTo] of this.mockArray) {
      if (mapFrom.disabled) {
        continue;
      }
      if (mapFrom.stringSlice) {
        const url = typeof request === 'string' ? request : request.url;
        if (url.includes(mapFrom.stringSlice)) {
          if (typeof request === 'string') {
            return mapTo.url;
          }
          const newRequest = new Request(mapTo.url, request);
          return newRequest;
        }
      }
    }
    return request;
  }
}
