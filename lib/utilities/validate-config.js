var Promise = require('ember-cli/lib/ext/promise');

var chalk  = require('chalk');
var yellow = chalk.yellow;
var blue   = chalk.blue;

function applyDefaultConfigIfNecessary(config, prop, defaultConfig, ui){
  if (!config[prop]) {
    var value = defaultConfig[prop];
    config[prop] = value;
    ui.write(blue('|    '));
    ui.writeLine(yellow('- Missing config: `' + prop + '`, using default: `' + value + '`'));
  }
}

module.exports = function(ui, config, projectName) {
  ui.write(blue('|    '));
  ui.writeLine(blue('- validating config'));

  var defaultConfig = {
    host: 'localhost',
    port: 6379,
    filePattern: 'dist/index.html',
    keyPrefix: projectName + ':index'
  };

  if (!config.url) {
    ['host', 'port'].forEach(function(prop) {
      applyDefaultConfigIfNecessary(config, prop, defaultConfig, ui);
    });
  }
  ['filePattern', 'keyPrefix'].forEach(function(configKey){
    applyDefaultConfigIfNecessary(config, configKey, defaultConfig, ui);
  });

  return Promise.resolve();
}
