/* jshint node: true */
'use strict';

var RSVP = require('rsvp');
var path = require('path');
var fs = require('fs');

var denodeify = require('rsvp').denodeify;
var readFile  = denodeify(fs.readFile);

var DeployPluginBase = require('ember-cli-deploy-plugin');

module.exports = {
  name: 'ember-cli-deploy-redis',

  createDeployPlugin: function(options) {
    var Redis = require('./lib/redis');

    var DeployPlugin = DeployPluginBase.extend({
      name: options.name,
      defaultConfig: {
        host: 'localhost',
        port: function(context) {
          if (context.tunnel && context.tunnel.srcPort) {
            return context.tunnel.srcPort;
          } else {
            return 6379;
          }
        },
        filePattern: 'index.html',
        maxRecentUploads: 10,
        distDir: function(context) {
          return context.distDir;
        },
        keyPrefix: function(context){
          return context.project.name() + ':index';
        },
        activationSuffix: 'current',
        activeContentSuffix: 'current-content',
        didDeployMessage: function(context){
          var revisionKey = context.revisionData && context.revisionData.revisionKey;
          var activatedRevisionKey = context.revisionData && context.revisionData.activatedRevisionKey;
          if (revisionKey && !activatedRevisionKey) {
            return "Deployed but did not activate revision " + revisionKey + ". "
                 + "To activate, run: "
                 + "ember deploy:activate " + context.deployTarget + " --revision=" + revisionKey + "\n";
          }
        },
        revisionKey: function(context) {
          return context.commandOptions.revision || (context.revisionData && context.revisionData.revisionKey);
        },
        redisDeployClient: function(context, pluginHelper) {
          var redisLib = context._redisLib;
          var options = {
            url: pluginHelper.readConfig('url'),
            host: pluginHelper.readConfig('host'),
            port: pluginHelper.readConfig('port'),
            password: pluginHelper.readConfig('password'),
            database: pluginHelper.readConfig('database'),
            maxRecentUploads: pluginHelper.readConfig('maxRecentUploads'),
            allowOverwrite: pluginHelper.readConfig('allowOverwrite'),
            activationSuffix: pluginHelper.readConfig('activationSuffix')
          };

          return new Redis(options, redisLib);
        },

        revisionData: function(context) {
          return context.revisionData;
        }
      },
      configure: function(/* context */) {
        this.log('validating config', { verbose: true });

        if (!this.pluginConfig.url) {
          ['host', 'port'].forEach(this.applyDefaultConfigProperty.bind(this));
        }

        ['filePattern', 'distDir', 'keyPrefix', 'activationSuffix', 'activeContentSuffix', 'revisionKey', 'didDeployMessage', 'redisDeployClient', 'maxRecentUploads', 'revisionData'].forEach(this.applyDefaultConfigProperty.bind(this));

        this.log('config ok', { verbose: true });
      },

      upload: function(/* context */) {
        var redisDeployClient = this.readConfig('redisDeployClient');
        var revisionKey       = this.readConfig('revisionKey');
        var distDir           = this.readConfig('distDir');
        var filePattern       = this.readConfig('filePattern');
        var keyPrefix         = this.readConfig('keyPrefix');
        var filePath          = path.join(distDir, filePattern);

        this.log('Uploading `' + filePath + '`', { verbose: true });
        return this._readFileContents(filePath)
          .then(redisDeployClient.upload.bind(redisDeployClient, keyPrefix, revisionKey, this.readConfig('revisionData')))
          .then(this._uploadSuccessMessage.bind(this))
          .then(function(key) {
            return { redisKey: key };
          })
          .catch(this._errorMessage.bind(this));
      },

      willActivate: function(/* context */) {
        var redisDeployClient = this.readConfig('redisDeployClient');
        var keyPrefix         = this.readConfig('keyPrefix');

        var revisionKey = redisDeployClient.activeRevision(keyPrefix);

        return RSVP.resolve(revisionKey).then(function(previousRevisionKey) {
          return {
            revisionData: {
              previousRevisionKey: previousRevisionKey
            }
          };
        });
      },

      activate: function(/* context */) {
        var redisDeployClient   = this.readConfig('redisDeployClient');
        var revisionKey         = this.readConfig('revisionKey');
        var keyPrefix           = this.readConfig('keyPrefix');
        var activationSuffix    = this.readConfig('activationSuffix');
        var activeContentSuffix = this.readConfig('activeContentSuffix');

        this.log('Activating revision `' + revisionKey + '`', { verbose: true });
        return RSVP.resolve(redisDeployClient.activate(keyPrefix, revisionKey, activationSuffix, activeContentSuffix))
          .then(this.log.bind(this, '✔ Activated revision `' + revisionKey + '`', {}))
          .then(function(){
            return {
              revisionData: {
                activatedRevisionKey: revisionKey
              }
            };
          })
          .catch(this._errorMessage.bind(this));
      },

      didDeploy: function(/* context */){
        var didDeployMessage = this.readConfig('didDeployMessage');
        if (didDeployMessage) {
          this.log(didDeployMessage);
        }
      },

      fetchInitialRevisions: function(/* context */) {
        var redisDeployClient = this.readConfig('redisDeployClient');
        var keyPrefix = this.readConfig('keyPrefix');

        this.log('Listing initial revisions for key: `' + keyPrefix + '`', { verbose: true });
        return RSVP.resolve(redisDeployClient.fetchRevisions(keyPrefix))
          .then(function(revisions) {
            return {
              initialRevisions: revisions
            };
          })
          .catch(this._errorMessage.bind(this));
      },

      fetchRevisions: function(/* context */) {
        var redisDeployClient = this.readConfig('redisDeployClient');
        var keyPrefix = this.readConfig('keyPrefix');

        this.log('Listing revisions for key: `' + keyPrefix + '`');
        return RSVP.resolve(redisDeployClient.fetchRevisions(keyPrefix))
          .then(function(revisions) {
            return {
              revisions: revisions
            };
          })
          .catch(this._errorMessage.bind(this));
      },

      _readFileContents: function(path) {
        return readFile(path)
          .then(function(buffer) {
            return buffer.toString();
          });
      },

      _uploadSuccessMessage: function(key) {
        this.log('Uploaded with key `' + key + '`', { verbose: true });
        return RSVP.resolve(key);
      },

      _errorMessage: function(error) {
        this.log(error, { color: 'red' });
        return RSVP.reject(error);
      }
    });

    return new DeployPlugin();
  }
};
