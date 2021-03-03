import { TargetToClientEventPayloadTypes } from 'typings/common';

export const FAKE_REGISTER_PAGE_INFO: TargetToClientEventPayloadTypes['registerPage'] = {
  uuid: '',
  url: 'http://localhost',
  description: '',
  title: '',
  deviceId: '',
  frameId: '',
  hostname: '',
  metadata: {
    appName: '',
    appCodeName: '',
    appVersion: '',
    product: '',
    platform: '',
    vendor: '',
    userAgent: '',
  },
  supportedDomains: [],
};
