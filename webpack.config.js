const webpack = require('webpack')
const path = require('path')
const fs = require('fs')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const MinifyPlugin = require('babel-minify-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const nodeExternals = require('webpack-node-externals');

// Any directories you will be adding code/files into, need to be added to this array so webpack will pick them up
const defaultInclude = path.resolve(__dirname, 'src')

module.exports = {
  devtool: 'source-map',
  entry: path.resolve(__dirname, "src/main.ts"),
  output: {
      path: path.resolve(__dirname, 'app'),
      filename: '[name].js',
  },
  target: 'electron-renderer',
  mode: 'development',
  externals: [
    /* Ignore import from bower packages */
    {
      jquery: 'jQuery',
      jquery: '$',
      angular: 'angular',
      mousetrap: 'Mousetrap',
      fuse: 'Fuse',
    },
    /* Ignore local app dependencies from runtime */
    nodeExternals({
      modulesDir: 'app/node_modules'
    }),
  ],
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader',
          'postcss-loader'
        ],
        include: defaultInclude
      },
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        include: defaultInclude,
        exclude: /node_modules/,
      },
      // {
      //   test: /\.jsx?$/,
      //   use: [{ loader: 'babel-loader' }],
      //   include: defaultInclude
      // },
      {
        test: /\.(jpe?g|png|gif)$/,
        use: [{ loader: 'file-loader?name=img/[name]__[hash:base64:5].[ext]' }],
        include: defaultInclude
      },
      {
        test: /\.(eot|svg|ttf|woff|woff2)$/,
        use: [{ loader: 'file-loader?name=font/[name]__[hash:base64:5].[ext]' }],
        include: defaultInclude
      },
      {
        test: /\.html$/i,
        loader: "html-loader",
      },
    ]
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.json'],
    modules: ['node_modules', 'src']
  },
  plugins: [
    // new HtmlWebpackPlugin({
    //     template: path.resolve(__dirname, "src/index.html")
    // }),
    new MiniCssExtractPlugin({
      // Options similar to the same options in webpackOptions.output
      // both options are optional
      filename: 'bundle.css',
      chunkFilename: '[id].css'
    }),
    // new webpack.DefinePlugin({
    //   'process.env.NODE_ENV': JSON.stringify('production')
    // }),
    new webpack.ProvidePlugin({
      'window.jQuery': 'jquery',
      'jQuery': 'jquery',
      '$': 'jquery',
      'angular': 'angular',
    }),
  ],
  stats: {
    colors: true,
    children: false,
    chunks: false,
    modules: false
  }
}
