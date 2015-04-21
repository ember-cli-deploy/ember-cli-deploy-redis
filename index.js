/* jshint node: true */
'use strict';

var fs        = require('fs');
var denodeify = require('rsvp').denodeify;
var path      = require('path');
var chalk     = require('chalk');

var blue      = chalk.blue;
var red       = chalk.red;

var Promise   = require('ember-cli/lib/ext/promise');

var readFile  = denodeify(fs.readFile);

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
      var filename = path.basename(indexPath);

      ui.write(blue('|      '));
      ui.write(blue('- Uploading `' + filename + '`\n'));

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

      upload: function(context) {
        var deployment = context.deployment;
        var ui         = deployment.ui;
        var config     = deployment.config[this.name] || {};
        var redis      = context.redisClient || new Redis(config);

        var projectName  = deployment.project.name();
        var tag          = context.tag;
        var key          = projectName + ':index';

        var indexPath = context.indexPath;

        return _beginMessage(ui, indexPath)
          .then(_readFileContents.bind(this, indexPath))
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
