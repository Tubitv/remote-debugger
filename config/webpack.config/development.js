import merge from 'webpack-merge';

import common from './common';

const config = {
  cache: true,
  mode: 'development',
  module: {
    rules: [],
  },
};

export default merge(common, config);
