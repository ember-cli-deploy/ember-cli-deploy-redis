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

    function _beginUploadMessage(ui, indexPath) {
      ui.write(blue('|      '));
      ui.write(blue('- Uploading `' + indexPath + '`\n'));

      return Promise.resolve();
    }

    function _beginActivateMessage(ui, revisionKey) {
      ui.write(blue('|      '));
      ui.write(blue('- Activating revision `' + revisionKey + '`\n'));

      return Promise.resolve();
    }

    function _successMessage(ui, key) {
      ui.write(blue('|      '));
      ui.write(blue('- Uploaded with key `' + key + '`\n'));

      return Promise.resolve(key);
    }

    function _activationSuccessMessage(ui, revisionKey) {
      ui.write(blue('|      '));
      ui.write(blue('- ✔ Activated revision `' + revisionKey + '`\n'));

      return Promise.resolve();
    }

    function _errorMessage(ui, error) {
      ui.write(blue('|      '));
      ui.write(red('- ' + error + '`\n'));

      return Promise.reject(error);
    }

    return {
      name: options.name,

      configure: function(context) {
        var deployment  = context.deployment;
        var ui          = deployment.ui;
        var config      = deployment.config[this.name] = deployment.config[this.name] || {};
        var projectName = deployment.project.name();

        return this._resolvePipelineData(config, context)
          .then(validateConfig.bind(this, ui, config, projectName));
      },

      upload: function(context) {
        var deployment  = context.deployment;
        var ui          = deployment.ui;
        var config      = deployment.config[this.name] || {};
        var redis       = context.redisClient || new Redis(config);
        var revisionKey = this._resolveConfigValue('revisionKey', config, context);

        var filePattern  = config.filePattern;

        return _beginUploadMessage(ui, filePattern)
          .then(_readFileContents.bind(this, filePattern))
          .then(redis.upload.bind(redis, config.keyPrefix, revisionKey))
          .then(_successMessage.bind(this, ui))
          .then(function(key) {
            return { redisKey: key }
          })
          .catch(_errorMessage.bind(this, ui));
      },

      activate: function(context) {
        var deployment  = context.deployment;
        var ui          = deployment.ui;
        var config      = deployment.config[this.name] || {};
        var redis       = context.redisClient || new Redis(config);
        var revisionKey = this._resolveConfigValue('revisionKey', config, context);

        return _beginActivateMessage(ui, revisionKey)
          .then(redis.activate.bind(redis, config.keyPrefix, revisionKey))
          .then(_activationSuccessMessage.bind(this, ui, revisionKey))
          .catch(_errorMessage.bind(this, ui));
      },

      _resolvePipelineData: function(config, context) {
        config.revisionKey = config.revisionKey || function(context) {
          return context.deployment.commandLineArgs.revisionKey || context.revisionKey;
        };

        return Promise.resolve();
      },

      _resolveConfigValue: function(key, config, context) {
        if(typeof config[key] === 'function') {
          return config[key](context);
        }

        return config[key];
      }
    };
  }
};
