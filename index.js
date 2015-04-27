/* jshint node: true */
'use strict';

var Promise   = require('ember-cli/lib/ext/promise');
var fs        = require('fs');

var chalk     = require('chalk');
var blue      = chalk.blue;
var red       = chalk.red;

var denodeify = require('rsvp').denodeify;
var readFile  = denodeify(fs.readFile);

var validateConfig = require('./lib/utilities/validate-config');

module.exports = {
  name: 'ember-cli-deploy-redis',

  createDeployPlugin: function(options) {
    var Redis = require('./lib/redis');

    function _readFileContents(path) {
      return readFile(path)
        .then(function(buffer) {
          return buffer.toString();
        });
    }

    function _beginMessage(ui, indexPath) {
      ui.write(blue('|      '));
      ui.write(blue('- Uploading `' + indexPath + '`\n'));

      return Promise.resolve();
    }

    function _successMessage(ui, key) {
      ui.write(blue('|      '));
      ui.write(blue('- Uploaded with key `' + key + '`\n'));

      return Promise.resolve(key);
    }

    function _errorMessage(ui, error) {
      ui.write(blue('|      '));
      ui.write(red('- ' + error + '`\n'));

      return Promise.reject(error);
    }

    return {
      name: options.name,

      willDeploy: function(context) {
        var deployment = context.deployment;
        var ui         = deployment.ui;
        var config     = deployment.config[this.name] = deployment.config[this.name] || {};

        return validateConfig(ui, config)
          .then(function() {
            ui.write(blue('|    '));
            ui.writeLine(blue('- config ok'));
          });
      },

      upload: function(context) {
        var deployment = context.deployment;
        var ui         = deployment.ui;
        var config     = deployment.config[this.name] || {};
        var redis      = context.redisClient || new Redis(config);

        var projectName  = deployment.project.name();
        var tag          = context.tag;
        var key          = projectName + ':index';

        var filePattern  = config.filePattern;

        return _beginMessage(ui, filePattern)
          .then(_readFileContents.bind(this, filePattern))
          .then(redis.upload.bind(redis, key, tag))
          .then(_successMessage.bind(this, ui))
          .then(function(key) {
            return { redisKey: key }
          })
          .catch(_errorMessage.bind(this, ui));
      }
    };
  }
};
