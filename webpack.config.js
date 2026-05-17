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
const semanticUiLessDir = path.resolve(__dirname, 'node_modules/semantic-ui-less')
const semanticThemeConfigPath = path.resolve(__dirname, 'src/renderer/assets/css/semantic/theme.config')
const isProduction = process.env.NODE_ENV === 'production'

const sharedResolve = {
  extensions: ['.ts', '.tsx', '.js', '.json'],
  alias: {
    '@main': path.resolve(__dirname, 'src/main'),
    '@renderer': path.resolve(__dirname, 'src/renderer'),
    '@shared': path.resolve(__dirname, 'src/shared'),
    '../../theme.config$': semanticThemeConfigPath,
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
      },
    },
    include: defaultInclude,
    exclude: /node_modules/,
  }
}

class RewriteThemeAssetUrlsPlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap('RewriteThemeAssetUrlsPlugin', (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: 'RewriteThemeAssetUrlsPlugin',
          stage: webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE,
        },
        (assets) => {
          const themeCssFiles = ['css/themes/light.css', 'css/themes/dark.css']

          for (const assetName of themeCssFiles) {
            const asset = assets[assetName]
            if (!asset) {
              continue
            }

            const rewritten = asset.source().toString()
              .replace(/(?:\.\.\/|\.\/)*(?:(?:\.generated\/)?semantic\/(?:light|dark)\/|node_modules\/semantic-ui-less\/)?themes\/(?:themes\/)?default\/assets\/fonts\//g, './default/assets/fonts/')
              .replace(/(?:\.\.\/|\.\/)*assets\/css\/(?:\.\/)?default\/assets\/fonts\//g, './default/assets/fonts/')
              .replace(/(?:\.\.\/|\.\/)*(?:(?:\.generated\/)?semantic\/(?:light|dark)\/|node_modules\/semantic-ui-less\/)?themes\/default\/assets\/images\//g, './default/assets/images/')
              .replace(/(?:\.\.\/|\.\/)*assets\/css\/(?:\.\/)?default\/assets\/images\//g, './default/assets/images/')

            compilation.updateAsset(assetName, new compiler.webpack.sources.RawSource(rewritten))
          }
        },
      )
    })
  }
}

const commonPlugins = [
  new CopyWebpackPlugin({
    patterns: [
      {
        from: path.resolve(__dirname, 'src/shared'),
        to: path.resolve(outDir, 'shared'),
      },
      {
        from: path.resolve(__dirname, 'build'),
        to: path.resolve(outDir, 'build'),
      },
      {
        from: path.resolve(__dirname, 'node_modules/semantic-ui-less/themes/default/assets'),
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
      path.resolve(__dirname, 'src/renderer/vendor.ts'),
      path.resolve(__dirname, 'src/renderer/assets/css/fonts/bittorrent.font.json'),
      path.resolve(__dirname, 'src/renderer/app.ts'),
    ],
    light: path.resolve(__dirname, 'src/renderer/styles/entries/light.less'),
    dark: path.resolve(__dirname, 'src/renderer/styles/entries/dark.less'),
  },
  output: {
    path: outDir,
    filename: '[name].js',
  },
  target: 'web',
  mode: isProduction ? 'production' : 'development',
  module: {
    rules: [
      makeTsRule('tsconfig.renderer.json'),
      {
        test: /\.font\.json$/i,
        type: 'javascript/auto',
        use: [
          'null-loader',
          'webfonts-loader',
        ],
      },
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
            loader: 'less-loader',
            options: {
              sourceMap: !isProduction,
              lessOptions: {
                math: 'always',
                paths: [path.resolve(__dirname, 'node_modules')],
              },
            },
          },
        ],
      },
      {
        test: /\.(jpe?g|png|gif)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'img/[name]__[hash:base64:5][ext]',
        },
      },
      {
        test: /\.(eot|svg|ttf|woff|woff2)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'css/fonts/[name]__[hash:base64:5][ext]',
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
    ...commonPlugins,
    new MiniCssExtractPlugin({
      filename: ({ chunk }) => {
        if (chunk && (chunk.name === 'light' || chunk.name === 'dark')) {
          return 'css/themes/[name].css'
        }

        return 'css/[name].css'
      },
    }),
    new RewriteThemeAssetUrlsPlugin(),
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

function makeNodeConfig({ name, entry, target }) {
  return {
    name,
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
      nodeExternals({
        modulesDir: 'app/node_modules',
      }),
    ],
    module: {
      rules: [makeTsRule('tsconfig.main.json')],
    },
    resolve: sharedResolve,
    stats: rendererConfig.stats,
  }
}

const preloadConfig = makeNodeConfig({
  name: 'preload',
  entry: {
    preload: path.resolve(__dirname, 'src/main/preload.ts'),
  },
  target: 'electron-preload',
})

const mainConfig = makeNodeConfig({
  name: 'main',
  entry: {
    main: path.resolve(__dirname, 'src/main/main.ts'),
  },
  target: 'electron-main',
})

export default [rendererConfig, preloadConfig, mainConfig]
