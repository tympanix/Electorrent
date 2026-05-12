const path = require('path')
const webpack = require('webpack')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const nodeExternals = require('webpack-node-externals')

const defaultInclude = path.resolve(__dirname, 'src')
const outDir = path.resolve(__dirname, 'app')
const isProduction = process.env.NODE_ENV === 'production'

const sharedResolve = {
  extensions: ['.ts', '.tsx', '.js', '.json'],
  modules: ['node_modules', 'src'],
}

const tsRule = {
  test: /\.tsx?$/,
  use: 'ts-loader',
  include: defaultInclude,
  exclude: /node_modules/,
}

const commonPlugins = [
  new CopyWebpackPlugin({
    patterns: [
      {
        from: path.resolve(__dirname, 'src/common'),
        to: path.resolve(outDir, 'common'),
      },
      {
        from: path.resolve(__dirname, 'build'),
        to: path.resolve(outDir, 'build'),
      },
      {
        from: path.resolve(__dirname, 'node_modules/semantic-ui-css/themes/default/assets'),
        to: path.resolve(outDir, 'css/themes/default/assets'),
      },
      {
        from: path.resolve(__dirname, 'src/renderer/assets/views'),
        to: path.resolve(outDir, 'views'),
        noErrorOnMissing: true,
      },
      {
        from: path.resolve(__dirname, 'src/renderer/assets/img'),
        to: path.resolve(outDir, 'img'),
        noErrorOnMissing: true,
      },
    ],
  }),
]

const rendererConfig = {
  name: 'renderer',
  devtool: 'source-map',
  entry: {
    app: [
      path.resolve(__dirname, 'src/renderer/assets/css/fonts/bittorrent.font.js'),
      path.resolve(__dirname, 'src/renderer/app.ts'),
    ],
  },
  output: {
    path: outDir,
    filename: '[name].js',
  },
  target: 'electron-renderer',
  mode: isProduction ? 'production' : 'development',
  externals: [
    {
      jquery: 'jQuery',
      angular: 'angular',
      mousetrap: 'Mousetrap',
      fuse: 'Fuse',
    },
    nodeExternals({
      modulesDir: 'app/node_modules',
    }),
  ],
  module: {
    rules: [
      tsRule,
      {
        test: /\.font\.js$/i,
        use: [
          'null-loader',
          'webfonts-loader',
        ],
      },
      {
        test: /\.(jpe?g|png|gif)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'img/[name]__[hash:base64:5][ext]',
        },
        include: defaultInclude,
      },
      {
        test: /\.(eot|svg|ttf|woff|woff2)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'font/[name]__[hash:base64:5][ext]',
        },
      },
      {
        test: /\.html$/i,
        loader: 'html-loader',
      },
    ],
  },
  resolve: sharedResolve,
  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'src/renderer/assets/index.ejs'),
      filename: 'index.html',
      inject: false,
    }),
    ...commonPlugins,
    new webpack.ProvidePlugin({
      'window.jQuery': 'jquery',
      jQuery: 'jquery',
      $: 'jquery',
      angular: 'angular',
    }),
  ],
  stats: {
    colors: true,
    children: false,
    chunks: false,
    modules: false,
  },
}

const preloadConfig = {
  name: 'preload',
  devtool: 'source-map',
  entry: {
    preload: path.resolve(__dirname, 'src/main/preload.ts'),
  },
  output: {
    path: outDir,
    filename: '[name].js',
    libraryTarget: 'commonjs2',
  },
  target: 'electron-preload',
  mode: isProduction ? 'production' : 'development',
  externals: [
    nodeExternals({
      modulesDir: 'app/node_modules',
    }),
  ],
  module: {
    rules: [tsRule],
  },
  resolve: sharedResolve,
  stats: rendererConfig.stats,
}

const mainConfig = {
  name: 'main',
  devtool: 'source-map',
  entry: {
    main: path.resolve(__dirname, 'src/main/main.ts'),
    'lib/config': path.resolve(__dirname, 'src/main/lib/config.ts'),
    'lib/logger': path.resolve(__dirname, 'src/main/lib/logger.ts'),
    'lib/torrents': path.resolve(__dirname, 'src/main/lib/torrents.ts'),
    'lib/themes': path.resolve(__dirname, 'src/main/lib/themes.ts'),
    'lib/menu': path.resolve(__dirname, 'src/main/lib/menu.ts'),
    'lib/update': path.resolve(__dirname, 'src/main/lib/update.ts'),
    'lib/certificates': path.resolve(__dirname, 'src/main/lib/certificates.ts'),
    'lib/electorrent': path.resolve(__dirname, 'src/main/lib/electorrent.ts'),
    'lib/startup': path.resolve(__dirname, 'src/main/lib/startup.ts'),
    'lib/bittorrent/index': path.resolve(__dirname, 'src/main/lib/bittorrent/index.ts'),
  },
  output: {
    path: outDir,
    filename: '[name].js',
    libraryTarget: 'commonjs2',
  },
  target: 'electron-main',
  mode: isProduction ? 'production' : 'development',
  externals: [
    nodeExternals({
      modulesDir: 'app/node_modules',
    }),
  ],
  module: {
    rules: [tsRule],
  },
  resolve: sharedResolve,
  stats: rendererConfig.stats,
}

module.exports = [rendererConfig, preloadConfig, mainConfig]
