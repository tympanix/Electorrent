import path from 'path'
import { fileURLToPath } from 'url'
import webpack from 'webpack'
import HtmlWebpackPlugin from 'html-webpack-plugin'
import CopyWebpackPlugin from 'copy-webpack-plugin'
import MiniCssExtractPlugin from 'mini-css-extract-plugin'
import RemoveEmptyScriptsPlugin from 'webpack-remove-empty-scripts'
import nodeExternals from 'webpack-node-externals'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const defaultInclude = path.resolve(__dirname, 'src')
const outDir = path.resolve(__dirname, 'app')
const fomanticUiDir = path.resolve(__dirname, 'node_modules/fomantic-ui')
const geoIpCountryDir = path.resolve(__dirname, 'node_modules/geoip-country')
const countriesListDir = path.resolve(__dirname, 'node_modules/countries-list')
const fomanticThemeConfigPath = path.resolve(__dirname, 'src/renderer/styles/semantic/theme.config')
const isProduction = process.env.NODE_ENV === 'production'

const sharedCache = {
  type: 'filesystem',
  buildDependencies: {
    config: [__filename],
  },
}

const sharedOptimization = {
  minimize: false,
}

const sharedResolve = {
  extensions: ['.ts', '.tsx', '.js', '.json'],
  alias: {
    '@main': path.resolve(__dirname, 'src/main'),
    '@renderer': path.resolve(__dirname, 'src/renderer'),
    '@shared': path.resolve(__dirname, 'src/shared'),
    '../../theme.config$': fomanticThemeConfigPath,
  },
  modules: ['node_modules', 'src'],
}

function makeTsRule(configFile) {
  return {
    test: /\.tsx?$/,
    use: {
      loader: 'ts-loader',
      options: {
        configFile: path.resolve(__dirname, configFile),
        transpileOnly: true,
      },
    },
    include: defaultInclude,
    exclude: /node_modules/,
  }
}

const commonPlugins = [
  new CopyWebpackPlugin({
    patterns: [
      {
        from: path.resolve(__dirname, 'src/shared'),
        to: path.resolve(outDir, 'shared'),
        globOptions: {
          ignore: ['**/tsconfig.json'],
        },
      },
      {
        from: path.resolve(__dirname, 'build'),
        to: path.resolve(outDir, 'build'),
      },
      {
        from: path.resolve(fomanticUiDir, 'src/themes/default/assets'),
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
      {
        from: geoIpCountryDir,
        to: path.resolve(outDir, 'node_modules/geoip-country'),
      },
      {
        from: countriesListDir,
        to: path.resolve(outDir, 'node_modules/countries-list'),
      },
    ],
  }),
]

const rendererConfig = {
  name: 'renderer',
  cache: sharedCache,
  optimization: sharedOptimization,
  devtool: 'source-map',
  entry: {
    app: [
      path.resolve(__dirname, 'src/renderer/vendor.ts'),
      path.resolve(__dirname, 'src/renderer/app.ts'),
    ],
    light: path.resolve(__dirname, 'src/renderer/styles/entries/light.less'),
    dark: path.resolve(__dirname, 'src/renderer/styles/entries/dark.less'),
    'context-menu': path.resolve(__dirname, 'src/renderer/context-menu.ts'),
  },
  output: {
    path: outDir,
    filename: '[name].js',
  },
  target: 'web',
  mode: isProduction ? 'production' : 'development',
  module: {
    rules: [
      makeTsRule('src/renderer/tsconfig.json'),
      {
        test: /\.less$/i,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: 'css-loader',
            options: {
              sourceMap: !isProduction,
              url: {
                filter: (url) => !url.includes('default/assets/'),
              },
            },
          },
          {
            loader: 'thread-loader',
            options: {
              workers: 2,
            },
          },
          {
            loader: 'less-loader',
            options: {
              sourceMap: !isProduction,
              lessOptions: {
                math: 'always',
                relativeUrls: false,
                paths: [path.resolve(__dirname, 'node_modules')],
              },
            },
          },
          'import-glob-loader',
        ],
      },
      {
        test: /\.(jpe?g|png|gif)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'img/[name]__[contenthash:5][ext]',
        },
      },
      {
        test: /\.(eot|svg|ttf|woff|woff2)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'css/fonts/[name]__[contenthash:5][ext]',
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
    new RemoveEmptyScriptsPlugin(),
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'src/renderer/assets/index.ejs'),
      filename: 'index.html',
      inject: 'body',
      scriptLoading: 'defer',
      chunks: ['app'],
    }),
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'src/renderer/assets/context-menu.ejs'),
      filename: 'context-menu.html',
      inject: 'body',
      scriptLoading: 'defer',
      chunks: ['context-menu'],
    }),
    ...commonPlugins,
    new MiniCssExtractPlugin({
      filename: ({ chunk }) => {
        if (chunk && (chunk.name === 'light' || chunk.name === 'dark')) {
          return 'css/themes/[name].css'
        }

        return 'css/[name].css'
      },
    }),
    new webpack.ProvidePlugin({
      'window.jQuery': 'jquery',
      jQuery: 'jquery',
      $: 'jquery',
    }),
  ],
  stats: {
    colors: true,
    children: false,
    chunks: false,
    modules: false,
  },
}

function makeNodeConfig({ name, entry, target, tsConfig }) {
  return {
    name,
    cache: sharedCache,
    optimization: sharedOptimization,
    devtool: 'source-map',
    entry,
    output: {
      path: outDir,
      filename: '[name].js',
      libraryTarget: 'commonjs2',
    },
    target,
    mode: isProduction ? 'production' : 'development',
    externals: [
      {
        'geoip-country': 'commonjs geoip-country',
      },
      nodeExternals({
        modulesDir: 'app/node_modules',
      }),
    ],
    module: {
      rules: [makeTsRule(tsConfig)],
    },
    resolve: sharedResolve,
    stats: rendererConfig.stats,
  }
}

const preloadConfig = makeNodeConfig({
  name: 'preload',
  entry: {
    preload: path.resolve(__dirname, 'src/preload/preload.ts'),
    'context-menu-preload': path.resolve(__dirname, 'src/preload/context-menu-preload.ts'),
  },
  target: 'electron-preload',
  tsConfig: 'src/preload/tsconfig.json',
})

const mainConfig = makeNodeConfig({
  name: 'main',
  entry: {
    main: path.resolve(__dirname, 'src/main/main.ts'),
  },
  target: 'electron-main',
  tsConfig: 'src/main/tsconfig.json',
})

export default [rendererConfig, preloadConfig, mainConfig]
