const path = require('path');

module.exports = {
  entry: './src/foxess-modbus-charge-period-card.js',
  output: {
    filename: 'foxess-modbus-charge-period-card.js',
    path: path.resolve(__dirname, 'dist'),
  },
  mode: 'production',
  devtool: 'source-map',
  watchOptions: {
    poll: 1000,
    ignored: 'node_modules',
  },
};
