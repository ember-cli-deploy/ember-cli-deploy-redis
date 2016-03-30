/* jshint node: true */
/* jshint jasmine: true */
'use strict';

var Promise = require('ember-cli/lib/ext/promise');
var assert  = require('ember-cli/tests/helpers/assert');
var FakeRedis = require('../helpers/fake-redis-lib');

var stubProject = {
  name: function(){
    return 'my-project';
  }
};

describe('redis plugin', function() {
  var subject, mockUi;

  beforeEach(function() {
    subject = require('../../index');
    mockUi = {
      verbose: true,
      messages: [],
      write: function() { },
      writeLine: function(message) {
        this.messages.push(message);
      }
    };
  });

  it('has a name', function() {
    var result = subject.createDeployPlugin({
      name: 'test-plugin'
    });

    assert.equal(result.name, 'test-plugin');
  });

  it('implements the correct hooks', function() {
    var plugin = subject.createDeployPlugin({
      name: 'test-plugin'
    });
    assert.ok(plugin.configure);
    assert.ok(plugin.upload);
    assert.ok(plugin.activate);
    assert.ok(plugin.didDeploy);
  });

  describe('configure hook', function() {
    it('runs without error if config is ok', function() {
      var plugin = subject.createDeployPlugin({
        name: 'redis'
      });

      var context = {
        ui: mockUi,
        project: stubProject,
        config: {
          redis: {
            host: 'somehost',
            port: 1234,
            database: 4
          }
        }
      };
      plugin.beforeHook(context);
      plugin.configure(context);
      assert.ok(true); // didn't throw an error
    });

    it('passes through config options', function () {
      var plugin = subject.createDeployPlugin({
        name: 'redis'
      });

      var redisLib = new FakeRedis();

      var context = {
        ui: mockUi,
        project: stubProject,
        config: {
          redis: {
            host: 'somehost',
            port: 1234,
            database: 4
          }
        },
        _redisLib: redisLib
      };
      plugin.beforeHook(context);
      plugin.configure(context);
      plugin.readConfig('redisDeployClient');

      assert.equal(redisLib.createdClient.options.host, 'somehost');
      assert.equal(redisLib.createdClient.options.port, 1234);
      assert.equal(redisLib.createdClient.options.database, 4);
    });

    describe('resolving port from the pipeline', function() {
      it('uses the config data if it already exists', function() {
        var plugin = subject.createDeployPlugin({
          name: 'redis'
        });

        var config = {
          host: 'somehost',
          port: 1234,
        };
        var context = {
          ui: mockUi,
          project: stubProject,
          config: {
            redis: config
          },
          tunnel: {
            srcPort: '2345'
          }
        };

        plugin.beforeHook(context);
        plugin.configure(context);
        assert.equal(plugin.readConfig('port'), '1234');
      });

      it('uses the context value if it exists and config doesn\'t', function() {
        var plugin = subject.createDeployPlugin({
          name: 'redis'
        });

        var config = {
          host: 'somehost',
        };
        var context = {
          ui: mockUi,
          project: stubProject,
          config: {
            redis: config
          },
          tunnel: {
            srcPort: '2345'
          }
        };

        plugin.beforeHook(context);
        plugin.configure(context);
        assert.equal(plugin.readConfig('port'), '2345');
      });

      it('uses the default port if config and context don\'t exist', function() {
        var plugin = subject.createDeployPlugin({
          name: 'redis'
        });

        var config = {
          host: 'somehost',
        };
        var context = {
          ui: mockUi,
          project: stubProject,
          config: {
            redis: config
          }
        };

        plugin.beforeHook(context);
        plugin.configure(context);
        assert.equal(plugin.readConfig('port'), '6379');
      });
    });

    describe('resolving revisionKey from the pipeline', function() {
      it('uses the config data if it already exists', function() {
        var plugin = subject.createDeployPlugin({
          name: 'redis'
        });

        var config = {
          host: 'somehost',
          port: 1234,
          revisionKey: '12345'
        };
        var context = {
          ui: mockUi,
          project: stubProject,
          config: {
            redis: config
          },
          revisionData: {
            revisionKey: 'something-else'
          }
        };

        plugin.beforeHook(context);
        plugin.configure(context);
        assert.equal(plugin.readConfig('revisionKey'), '12345');
      });

      it('uses the commandOptions value if it exists', function() {
        var plugin = subject.createDeployPlugin({
          name: 'redis'
        });

        var config = {
          host: 'somehost',
          port: 1234
        };
        var context = {
          ui: mockUi,
          project: stubProject,
          config: {
            redis: config
          },
          commandOptions: {
            revision: 'abcd'
          },
          revisionData: {
            revisionKey: 'something-else'
          }
        };

        plugin.beforeHook(context);
        plugin.configure(context);
        assert.typeOf(config.revisionKey, 'function');
        assert.equal(config.revisionKey(context), 'abcd');
      });

      it('uses the context value if it exists and commandOptions doesn\'t', function() {
        var plugin = subject.createDeployPlugin({
          name: 'redis'
        });

        var config = {
          host: 'somehost',
          port: 1234
        };
        var context = {
          ui: mockUi,
          project: stubProject,
          config: {
            redis: config
          },
          commandOptions: { },
          revisionData: {
            revisionKey: 'something-else'
          }
        };

        plugin.beforeHook(context);
        plugin.configure(context);
        assert.typeOf(config.revisionKey, 'function');
        assert.equal(config.revisionKey(context), 'something-else');
      });
    });
    describe('without providing config', function () {
      var config, plugin, context;
      beforeEach(function() {
        config = { };
        plugin = subject.createDeployPlugin({
          name: 'redis'
        });
        context = {
          ui: mockUi,
          project: stubProject,
          config: config
        };
        plugin.beforeHook(context);
      });
      it('warns about missing optional config', function() {
        plugin.configure(context);
        var messages = mockUi.messages.reduce(function(previous, current) {
          if (/- Missing config:\s.*, using default:\s/.test(current)) {
            previous.push(current);
          }

          return previous;
        }, []);
        assert.equal(messages.length, 12);
      });
      it('adds default config to the config object', function() {
        plugin.configure(context);
        assert.isDefined(config.redis.host);
        assert.isDefined(config.redis.port);
        assert.isDefined(config.redis.keyPrefix);
        assert.isDefined(config.redis.activationSuffix);
        assert.isDefined(config.redis.didDeployMessage);
      });
    });

    describe('with a keyPrefix provided', function () {
      var config, plugin, context;
      beforeEach(function() {
        config = {
          redis: {
            keyPrefix: 'proj:home'
          }
        };
        plugin = subject.createDeployPlugin({
          name: 'redis'
        });
        context = {
          ui: mockUi,
          project: stubProject,
          config: config
        };
        plugin.beforeHook(context);
      });
      it('warns about missing optional filePattern, distDir, activationSuffix, revisionKey, didDeployMessage, maxNumberOfRecentUploads, and connection info', function() {
        plugin.configure(context);
        var messages = mockUi.messages.reduce(function(previous, current) {
          if (/- Missing config:\s.*, using default:\s/.test(current)) {
            previous.push(current);
          }

          return previous;
        }, []);
        assert.equal(messages.length, 11);
      });
      it('does not add default config to the config object', function() {
        plugin.configure(context);
        assert.isDefined(config.redis.host);
        assert.isDefined(config.redis.port);
        assert.isDefined(config.redis.filePattern);
        assert.isDefined(config.redis.activationSuffix);
        assert.isDefined(config.redis.didDeployMessage);
        assert.equal(config.redis.keyPrefix, 'proj:home');
      });
    });

    describe('with an activationSuffix provided', function () {
      var config, plugin, context;
      beforeEach(function() {
        config = {
          redis: {
            activationSuffix: 'special:suffix'
          }
        };
        plugin = subject.createDeployPlugin({
          name: 'redis'
        });
        context = {
          ui: mockUi,
          project: stubProject,
          config: config
        };
        plugin.beforeHook(context);
      });
      it('warns about missing optional filePattern, distDir, keyPrefix, revisionKey, didDeployMessage, maxNumberOfRecentUploads, and connection info', function() {
        plugin.configure(context);
        var messages = mockUi.messages.reduce(function(previous, current) {
          if (/- Missing config:\s.*, using default:\s/.test(current)) {
            previous.push(current);
          }

          return previous;
        }, []);
        assert.equal(messages.length, 11)
      });
      it('does not add default config to the config object', function() {
        plugin.configure(context);
        assert.isDefined(config.redis.host);
        assert.isDefined(config.redis.port);
        assert.isDefined(config.redis.filePattern);
        assert.isDefined(config.redis.keyPrefix);
        assert.isDefined(config.redis.didDeployMessage);
        assert.equal(config.redis.activationSuffix, 'special:suffix');
      });
    });

    describe('with a url provided', function () {
      var config, plugin, context;
      beforeEach(function() {
        config = {
          redis: {
            url: 'redis://localhost:6379'
          }
        };
        plugin = subject.createDeployPlugin({
          name: 'redis'
        });
        context = {
          ui: mockUi,
          project: stubProject,
          config: config
        };
        plugin.beforeHook(context);
      });
      it('warns about missing optional filePattern, distDir, keyPrefix, activationSuffix, revisionKey, maxNumberOfRecentUploads, and didDeployMessage only', function() {
        plugin.configure(context);
        var messages = mockUi.messages.reduce(function(previous, current) {
          if (/- Missing config:\s.*, using default:\s/.test(current)) {
            previous.push(current);
          }

          return previous;
        }, []);
        assert.equal(messages.length, 10);
      });

      it('does not add default config to the config object', function() {
        plugin.configure(context);
        assert.isUndefined(config.redis.host);
        assert.isUndefined(config.redis.port);
        assert.isDefined(config.redis.filePattern);
        assert.isDefined(config.redis.didDeployMessage);
      });
    });

    describe('with aliases', function () {
      it('passes config for specified alias to redis', function () {
        var plugin = subject.createDeployPlugin({
          name: 'foobar'
        });

        var redisLib = new FakeRedis();

        var config = {
          database: 7
        };
        var context = {
          ui: mockUi,
          project: stubProject,
          config: {
            foobar: config
          },
          _redisLib: redisLib
        };

        plugin.beforeHook(context);
        plugin.configure(context);
        plugin.readConfig('redisDeployClient');

        assert.equal(redisLib.createdClient.options.database, 7);
      });
    });
  });

  describe('upload hook', function() {
    var plugin;
    var context;

    it('uploads the index', function() {
      plugin = subject.createDeployPlugin({
        name: 'redis'
      });

      context = {
        ui: mockUi,
        project: stubProject,
        config: {
          redis: {
            keyPrefix: 'test-prefix',
            filePattern: 'index.html',
            distDir: 'tests',
            revisionKey: '123abc',
            redisDeployClient: function(context) {
              return {
                upload: function(keyPrefix, revisionKey) {
                  return Promise.resolve(keyPrefix + ':' + revisionKey);
                }
              };
            }
          }
        }
      };
      plugin.beforeHook(context);
      plugin.configure(context);

      return assert.isFulfilled(plugin.upload(context))
        .then(function(result) {
          assert.deepEqual(result, { redisKey: 'test-prefix:123abc' });
        });
    });
  });

  describe('activate hook', function() {
    it('activates revision', function() {
      var activateCalled = false;

      var plugin = subject.createDeployPlugin({
        name: 'redis'
      });

      var context = {
        ui: mockUi,
        project: stubProject,
        config: {
          redis: {
            keyPrefix: 'test-prefix',
            filePattern: 'index.html',
            distDir: 'tests',
            revisionKey: '123abc',
            redisDeployClient: function(context){
              return {
                activate: function() {
                  activateCalled = true;
                }
              };
            }
          }
        }
      };
      plugin.beforeHook(context);

      return assert.isFulfilled(plugin.activate(context))
        .then(function(result) {
          assert.ok(activateCalled);
          assert.equal(result.revisionData.activatedRevisionKey, '123abc');
        });
    });

    it('rejects if an error is thrown when activating', function() {
      var plugin = subject.createDeployPlugin({
        name: 'redis'
      });

      var context = {
        ui: mockUi,
        project: stubProject,
        config: {
          redis: {
            keyPrefix: 'test-prefix',
            filePattern: 'index.html',
            distDir: 'tests',
            revisionKey: '123abc',
            redisDeployClient: function(context) {
              return {
                activate: function() {
                  return Promise.reject('some-error');
                }
              };
            }
          }
        }
      };

      plugin.beforeHook(context);
      return assert.isRejected(plugin.activate(context))
        .then(function(error) {
          assert.equal(error, 'some-error');
        });
    });
  });
  describe('didDeploy hook', function() {
    it('prints default message about lack of activation when revision has not been activated', function() {
      var messageOutput = '';

      var plugin = subject.createDeployPlugin({
        name: 'redis'
      });
      plugin.upload = function(){};
      plugin.activate = function(){};

      var context = {
        deployTarget: 'qa',
        ui: {
          write: function(message){
            messageOutput = messageOutput + message;
          },
          writeLine: function(message){
            messageOutput = messageOutput + message + '\n';
          }
        },
        project: stubProject,
        config: {
          redis: { }
        },
        revisionData: {
          revisionKey: '123abc',
        }
      };
      plugin.beforeHook(context);
      plugin.configure(context);
      plugin.beforeHook(context);
      plugin.didDeploy(context);
      assert.match(messageOutput, /Deployed but did not activate revision 123abc./);
      assert.match(messageOutput, /To activate, run/);
      assert.match(messageOutput, /ember deploy:activate qa --revision=123abc/);
    });
  });

  describe('fetchInitialRevisions hook', function() {
    it('fills the initialRevisions variable on context', function() {
      var plugin;
      var context;

      plugin = subject.createDeployPlugin({
        name: 'redis'
      });

      context = {
        ui: mockUi,
        project: stubProject,
        config: {
          redis: {
            keyPrefix: 'test-prefix',
            filePattern: 'index.html',
            distDir: 'tests',
            revisionKey: '123abc',
            redisDeployClient: function(context) {
              return {
                fetchRevisions: function(keyPrefix, revisionKey) {
                  return Promise.resolve([{
                    revision: 'a',
                    active: false
                  }]);
                }
              };
            }
          }
        }
      };
      plugin.beforeHook(context);
      plugin.configure(context);

      return assert.isFulfilled(plugin.fetchInitialRevisions(context))
        .then(function(result) {
          assert.deepEqual(result, {
            initialRevisions: [{
              "active": false,
              "revision": "a"
            }]
          });
        });
    });
  });

  describe('fetchRevisions hook', function() {
    it('fills the revisions variable on context', function() {
      var plugin;
      var context;

      plugin = subject.createDeployPlugin({
        name: 'redis'
      });

      context = {
        ui: mockUi,
        project: stubProject,
        config: {
          redis: {
            keyPrefix: 'test-prefix',
            filePattern: 'index.html',
            distDir: 'tests',
            revisionKey: '123abc',
            redisDeployClient: function(context) {
              return {
                fetchRevisions: function(keyPrefix, revisionKey) {
                  return Promise.resolve([{
                    revision: 'a',
                    active: false
                  }]);
                }
              };
            }
          }
        }
      };
      plugin.beforeHook(context);
      plugin.configure(context);

      return assert.isFulfilled(plugin.fetchRevisions(context))
        .then(function(result) {
          assert.deepEqual(result, {
              revisions: [{
                "active": false,
                "revision": "a"
              }]
          });
        });
    });
  });
});
