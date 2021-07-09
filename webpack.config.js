const path = require('path');

module.exports = {
  mode: 'development',
  entry: './js/multi_view_post.js',
  target: 'electron-renderer',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
  }
};