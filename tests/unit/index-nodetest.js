'use strict';

var Promise = require('ember-cli/lib/ext/promise');
var assert  = require('ember-cli/tests/helpers/assert');
var CoreObject = require('core-object');

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

      var redisDeployClientClassInitialised = false;
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
        redisDeployClientClass: CoreObject.extend({
          init: function (options) {
            assert.equal(options.host, 'somehost');
            assert.equal(options.port, 1234);
            assert.equal(options.database, 4);
            redisDeployClientClassInitialised = true;
          }
        })
      };
      plugin.beforeHook(context);
      plugin.configure(context);
      plugin.readConfig("redisDeployClient");
      assert.ok(redisDeployClientClassInitialised);
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
          revisionKey: 'something-else'
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
          revisionKey: 'something-else'
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
          revisionKey: 'something-else'
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
        assert.equal(messages.length, 8);
      });
      it('adds default config to the config object', function() {
        plugin.configure(context);
        assert.isDefined(config.redis.host);
        assert.isDefined(config.redis.port);
        assert.isDefined(config.redis.keyPrefix);
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
      it('warns about missing optional filePattern, distDir, revisionKey, didDeployMessage, and connection info', function() {
        plugin.configure(context);
        var messages = mockUi.messages.reduce(function(previous, current) {
          if (/- Missing config:\s.*, using default:\s/.test(current)) {
            previous.push(current);
          }

          return previous;
        }, []);
        assert.equal(messages.length, 7);
      });
      it('does not add default config to the config object', function() {
        plugin.configure(context);
        assert.isDefined(config.redis.host);
        assert.isDefined(config.redis.port);
        assert.isDefined(config.redis.filePattern);
        assert.isDefined(config.redis.didDeployMessage);
        assert.equal(config.redis.keyPrefix, 'proj:home');
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
      it('warns about missing optional filePattern, distDir, keyPrefix, revisionKey and didDeployMessage only', function() {
        plugin.configure(context);
        var messages = mockUi.messages.reduce(function(previous, current) {
          if (/- Missing config:\s.*, using default:\s/.test(current)) {
            previous.push(current);
          }

          return previous;
        }, []);
        assert.equal(messages.length, 6);
      });

      it('does not add default config to the config object', function() {
        plugin.configure(context);
        assert.isUndefined(config.redis.host);
        assert.isUndefined(config.redis.port);
        assert.isDefined(config.redis.filePattern);
        assert.isDefined(config.redis.didDeployMessage);
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
        redisClient: {
          upload: function(keyPrefix, revisionKey) {
            return Promise.resolve(keyPrefix + ':' + revisionKey);
          }
        },
        ui: mockUi,
        project: stubProject,
        config: {
          redis: {
            keyPrefix: 'test-prefix',
            filePattern: 'index.html',
            distDir: 'tests',
            revisionKey: '123abc',
            redisDeployClient: function(context) {
              return context.redisClient || new Redis(context.config.redis);
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
        redisClient: {
          activate: function() {
            activateCalled = true;
          }
        },
        ui: mockUi,
        project: stubProject,
        config: {
          redis: {
            keyPrefix: 'test-prefix',
            filePattern: 'index.html',
            distDir: 'tests',
            revisionKey: '123abc',
            redisDeployClient: function(context){ return context.redisClient; }
          }
        }
      };
      plugin.beforeHook(context);

      return assert.isFulfilled(plugin.activate(context))
        .then(function(result) {
          assert.ok(activateCalled);
          assert.equal(result.activatedRevisionKey, '123abc');
        });
    });

    it('rejects if an error is thrown when activating', function() {
      var plugin = subject.createDeployPlugin({
        name: 'redis'
      });

      var context = {
        redisClient: {
          activate: function() {
            return Promise.reject('some-error');
          }
        },
        ui: mockUi,
        project: stubProject,
        config: {
          redis: {
            keyPrefix: 'test-prefix',
            filePattern: 'index.html',
            distDir: 'tests',
            revisionKey: '123abc',
            redisDeployClient: function(context) {
              return context.redisClient || new Redis(context.config.redis);
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
          redis: {
            revisionKey: '123abc',
            activatedRevisionKey: null
          }
        },
        revisionKey: '123abc',
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
});
