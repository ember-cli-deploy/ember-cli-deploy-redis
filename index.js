/* jshint node: true */
'use strict';

let path = require('path');
let fs = require('fs');

let DeployPluginBase = require('ember-cli-deploy-plugin');

module.exports = {
  name: 'ember-cli-deploy-redis',

  createDeployPlugin(options) {
    var Redis = require('./lib/redis');

    var DeployPlugin = DeployPluginBase.extend({
      name: options.name,
      defaultConfig: {
        host: 'localhost',
        port(context) {
          if (context.tunnel && context.tunnel.srcPort) {
            return context.tunnel.srcPort;
          } else {
            return 6379;
          }
        },
        filePattern: 'index.html',
        maxRecentUploads: 10,
        distDir(context) {
          return context.distDir;
        },
        keyPrefix(context){
          return `${context.project.name()}:index`;
        },
        activationSuffix: 'current',
        activeContentSuffix: 'current-content',
        didDeployMessage(context){
          var revisionKey = context.revisionData && context.revisionData.revisionKey;
          var activatedRevisionKey = context.revisionData && context.revisionData.activatedRevisionKey;
          if (revisionKey && !activatedRevisionKey) {
            return `Deployed but did not activate revision ${revisionKey}. `
                 + `To activate, run: `
                 + `ember deploy:activate ${context.deployTarget} --revision=${revisionKey}` + "\n";
          }
        },
        revisionKey(context) {
          return context.commandOptions.revision || (context.revisionData && context.revisionData.revisionKey);
        },
        redisDeployClient(context, pluginHelper) {
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

        revisionData(context) {
          return context.revisionData;
        }
      },
      configure(/* context */) {
        this.log('validating config', { verbose: true });

        if (!this.pluginConfig.url) {
          ['host', 'port'].forEach(this.applyDefaultConfigProperty.bind(this));
        } else {
          var redisUrlRegexp = new RegExp('^rediss?://');

          if (!this.pluginConfig.url.match(redisUrlRegexp)) {
            throw new Error(`Your Redis URL appears to be missing the "redis://" protocol. Update your URL to: redis://${this.pluginConfig.url}`);
          }
        }

        ['filePattern', 'distDir', 'keyPrefix', 'activationSuffix', 'activeContentSuffix', 'revisionKey', 'didDeployMessage', 'redisDeployClient', 'maxRecentUploads', 'revisionData'].forEach(this.applyDefaultConfigProperty.bind(this));

        this.log('config ok', { verbose: true });
      },

      async upload(/* context */) {
        let redisDeployClient = this.readConfig('redisDeployClient');
        let revisionKey       = this.readConfig('revisionKey');
        let distDir           = this.readConfig('distDir');
        let filePattern       = this.readConfig('filePattern');
        let keyPrefix         = this.readConfig('keyPrefix');
        let filePath          = path.join(distDir, filePattern);

        this.log(`Uploading \`${filePath}\``, { verbose: true });
        try {
          let fileContents = await this._readFileContents(filePath);
          let key = await redisDeployClient.upload(keyPrefix, revisionKey, this.readConfig('revisionData'), fileContents);
          this._logUploadSuccessMessage(key);
          return { redisKey: key };
        } catch(e) {
          this._logErrorMessage(e);
          throw e;
        }
      },

      async willActivate(/* context */) {
        let redisDeployClient = this.readConfig('redisDeployClient');
        let keyPrefix         = this.readConfig('keyPrefix');

        let previousRevisionKey = await redisDeployClient.activeRevision(keyPrefix);
        return {
          revisionData: {
            previousRevisionKey
          }
        };
      },

      async activate(/* context */) {
        let redisDeployClient   = this.readConfig('redisDeployClient');
        let revisionKey         = this.readConfig('revisionKey');
        let keyPrefix           = this.readConfig('keyPrefix');
        let activationSuffix    = this.readConfig('activationSuffix');
        let activeContentSuffix = this.readConfig('activeContentSuffix');

        this.log(`Activating revision \`${revisionKey}\``, { verbose: true });
        try {
          await redisDeployClient.activate(keyPrefix, revisionKey, activationSuffix, activeContentSuffix);
          this.log(`✔ Activated revision \`${revisionKey}\``, {});
          return {
            revisionData: {
              activatedRevisionKey: revisionKey
            }
          };
        } catch(e) {
          this._logErrorMessage(e);
          throw e;
        }
      },

      didDeploy(/* context */){
        var didDeployMessage = this.readConfig('didDeployMessage');
        if (didDeployMessage) {
          this.log(didDeployMessage);
        }
      },

      async fetchInitialRevisions(/* context */) {
        let redisDeployClient = this.readConfig('redisDeployClient');
        let keyPrefix = this.readConfig('keyPrefix');

        this.log(`Fetching initial revisions for key: \`${keyPrefix}\``, { verbose: true });
        try {
          let initialRevisions = await redisDeployClient.fetchRevisions(keyPrefix);
          return {
            initialRevisions
          };
        } catch(e) {
          this._logErrorMessage(e);
          throw e;
        }
      },

      async fetchRevisions(/* context */) {
        let redisDeployClient = this.readConfig('redisDeployClient');
        let keyPrefix = this.readConfig('keyPrefix');
        this.log(`Fetching revisions for key: \`${keyPrefix}\``, { verbose: true });
        try {
          let revisions = await redisDeployClient.fetchRevisions(keyPrefix);
          return {
            revisions
          };
        } catch(e) {
          this._logErrorMessage(e);
          throw e;
        }
      },

      async _readFileContents(path) {
        let buffer = await fs.promises.readFile(path);
        return buffer.toString();
      },

      _logUploadSuccessMessage(key) {
        this.log(`Uploaded with key \`${key}\``, { verbose: true });
      },

      _logErrorMessage(error) {
        this.log(error, { color: 'red' });
      }
    });

    return new DeployPlugin();
  }
};
