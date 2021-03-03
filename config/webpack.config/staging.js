import webpack from 'webpack';
import merge from 'webpack-merge';
import TerserPlugin from 'terser-webpack-plugin';

import common from './common';

const config = {
  bail: true,
  // debug: false,
  profile: false,
  devtool: 'source-map',
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        cache: true,
        extractComments: true,
        parallel: true,
        sourceMap: true,
      }),
    ],
  },
  plugins: [
    new webpack.NoEmitOnErrorsPlugin(),
    new webpack.optimize.OccurrenceOrderPlugin(true),
  ],
  module: {
    rules: [],
  },
};

export default merge(common, config);
