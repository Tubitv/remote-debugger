import path from 'path';
import webpack from 'webpack';

const ENV = process.env.NODE_ENV || 'development';
const PATHS = {
  root: path.resolve(__dirname, '..', '..'),
  dist: path.resolve(__dirname, '..', '..', 'build'),
};

export { ENV, PATHS };

export default {
  context: path.resolve(PATHS.root, 'lib'),
  devtool: 'inline-source-map',
  output: {
    path: path.resolve(PATHS.root, 'build'),
    filename: '[name].js',
  },
  entry: {
    'scripts/launcher': './frontend/launcher.bundle.ts',
    'scripts/redux-devtools': './redux-devtools/index.js',
    'scripts/pages/index': './pages/index.tsx',
  },
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
    alias: {
      driver: path.resolve(__dirname, 'lib/driver'),
    },
  },
  cache: true,
  stats: {
    colors: true,
    reasons: true,
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules\/(?!(debug))/,
        use: [
          {
            loader: 'babel-loader',
            options: {
              presets: [
                ['@babel/preset-env', { modules: false }],
              ],
            },
          },
        ],
      },
      {
        test: /\.jsx?$/,
        exclude: /node_module/,
        use: [
          'eslint-loader',
        ],
      },
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: [
          'style-loader',
          {
            loader: 'css-loader',
            options: {
              importLoaders: 1,
              modules: true,
            },
          },
        ],
        include: /\.module\.css$/,
      },
      {
        test: /\.css$/,
        use: [
          'style-loader',
          'css-loader',
        ],
        exclude: /\.module\.css$/,
      },
      {
        test: [/\.bmp$/, /\.gif$/, /\.jpe?g$/, /\.png$/],
        loader: 'url-loader',
      },
      {
        test: [/\.eot$/, /\.ttf$/, /\.svg$/, /\.woff$/, /\.woff2$/],
        loader: 'file-loader',
        options: {
          outputPath: 'assets',
        },
      },
    ],
  },
  // resolve bower components based on the 'main' property
  plugins: [
    new webpack.optimize.LimitChunkCountPlugin({
      maxChunks: 10,
    }),
    new webpack.optimize.MinChunkSizePlugin({
      minChunkSize: 20000,
    }),
    new webpack.DefinePlugin({
      __TESTING__: false,
    }),
  ],
};
