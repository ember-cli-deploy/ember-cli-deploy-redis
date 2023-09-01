/* jshint node: true */
'use strict';

const { glob } = require('glob');
const path = require('path');
const fs = require('fs');

const DeployPluginBase = require('ember-cli-deploy-plugin');

module.exports = {
  name: 'ember-cli-deploy-redis',

  createDeployPlugin(options) {
    const Redis = require('./lib/redis');

    const DeployPlugin = DeployPluginBase.extend({
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
        keyPrefix(context) {
          return `${context.project.name()}:index`;
        },
        activationSuffix: 'current',
        activeContentSuffix: 'current-content',
        didDeployMessage(context) {
          const revisionKey = context.revisionData && context.revisionData.revisionKey;
          const activatedRevisionKey = context.revisionData && context.revisionData.activatedRevisionKey;
          if (revisionKey && !activatedRevisionKey) {
            return (
              `Deployed but did not activate revision ${revisionKey}. ` +
              `To activate, run: ` +
              `ember deploy:activate ${context.deployTarget} --revision=${revisionKey}` +
              '\n'
            );
          }
        },
        revisionKey(context) {
          return context.commandOptions.revision || (context.revisionData && context.revisionData.revisionKey);
        },
        redisDeployClient(context, pluginHelper) {
          const redisLib = context._redisLib;
          const libOptions = {
            url: pluginHelper.readConfig('url'),
            host: pluginHelper.readConfig('host'),
            port: pluginHelper.readConfig('port'),
            password: pluginHelper.readConfig('password'),
            database: pluginHelper.readConfig('database'),
            redisOptions: pluginHelper.readConfig('redisOptions'),
            maxRecentUploads: pluginHelper.readConfig('maxRecentUploads'),
            allowOverwrite: pluginHelper.readConfig('allowOverwrite'),
            activationSuffix: pluginHelper.readConfig('activationSuffix')
          };

          return new Redis(libOptions, redisLib);
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
          const redisUrlRegexp = new RegExp('^rediss?://');

          if (!this.pluginConfig.url.match(redisUrlRegexp)) {
            throw new Error(
              `Your Redis URL appears to be missing the "redis://" protocol. Update your URL to: redis://${this.pluginConfig.url}`
            );
          }
        }

        [
          'filePattern',
          'distDir',
          'keyPrefix',
          'activationSuffix',
          'activeContentSuffix',
          'revisionKey',
          'didDeployMessage',
          'redisDeployClient',
          'maxRecentUploads',
          'revisionData'
        ].forEach(this.applyDefaultConfigProperty.bind(this));

        this.log('config ok', { verbose: true });
      },

      async upload(/* context */) {
        const redisDeployClient = this.readConfig('redisDeployClient');
        const revisionKey = this.readConfig('revisionKey');
        const distDir = this.readConfig('distDir');
        const filePattern = this.readConfig('filePattern');
        const keyPrefix = this.readConfig('keyPrefix');
        const filePathGlob = path.join(distDir, '**', filePattern);

        const filePaths = await glob(filePathGlob);

        if (filePaths.length === 0) {
          throw new Error(`No index files found using pattern: ${filePathGlob}`);
        }

        if (filePaths.length) {
          const keys = [];
          for (const filePath of filePaths) {
            this.log(`Uploading \`${filePath}\``, { verbose: true });
            try {
              let prefix = keyPrefix;
              const fileContents = await this._readFileContents(filePath);
              const relativePath = path.relative(distDir, filePath);
              const directoryName = path.dirname(relativePath);

              if (directoryName !== '' && directoryName !== '.') {
                prefix = `${keyPrefix.replace(':index', `:${directoryName}:index`)}`;
              }

              const key = await redisDeployClient.upload(
                prefix,
                revisionKey,
                this.readConfig('revisionData'),
                fileContents
              );
              this._logUploadSuccessMessage(key);
              keys.push({ path: directoryName, redisKey: key });
            } catch (e) {
              this._logErrorMessage(e);
              throw e;
            }
          }
          return keys;
        }
      },

      async willActivate(/* context */) {
        const redisDeployClient = this.readConfig('redisDeployClient');
        const keyPrefix = this.readConfig('keyPrefix');

        const previousRevisionKey = await redisDeployClient.activeRevision(keyPrefix);
        return {
          revisionData: {
            previousRevisionKey
          }
        };
      },

      async activate(/* context */) {
        const redisDeployClient = this.readConfig('redisDeployClient');
        const revisionKey = this.readConfig('revisionKey');
        const keyPrefix = this.readConfig('keyPrefix');
        const activationSuffix = this.readConfig('activationSuffix');
        const activeContentSuffix = this.readConfig('activeContentSuffix');

        this.log(`Activating revision \`${revisionKey}\``, { verbose: true });
        try {
          await redisDeployClient.activate(keyPrefix, revisionKey, activationSuffix, activeContentSuffix);
          this.log(`✔ Activated revision \`${revisionKey}\``, {});
          return {
            revisionData: {
              activatedRevisionKey: revisionKey
            }
          };
        } catch (e) {
          this._logErrorMessage(e);
          throw e;
        }
      },

      didDeploy(/* context */) {
        const didDeployMessage = this.readConfig('didDeployMessage');
        if (didDeployMessage) {
          this.log(didDeployMessage);
        }
      },

      async fetchInitialRevisions(/* context */) {
        const redisDeployClient = this.readConfig('redisDeployClient');
        const keyPrefix = this.readConfig('keyPrefix');

        this.log(`Fetching initial revisions for key: \`${keyPrefix}\``, {
          verbose: true
        });
        try {
          const initialRevisions = await redisDeployClient.fetchRevisions(keyPrefix);
          return {
            initialRevisions
          };
        } catch (e) {
          this._logErrorMessage(e);
          throw e;
        }
      },

      async fetchRevisions(/* context */) {
        const redisDeployClient = this.readConfig('redisDeployClient');
        const keyPrefix = this.readConfig('keyPrefix');
        this.log(`Fetching revisions for key: \`${keyPrefix}\``, {
          verbose: true
        });
        try {
          const revisions = await redisDeployClient.fetchRevisions(keyPrefix);
          return {
            revisions
          };
        } catch (e) {
          this._logErrorMessage(e);
          throw e;
        }
      },

      async _readFileContents(path) {
        const buffer = await fs.promises.readFile(path);
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
