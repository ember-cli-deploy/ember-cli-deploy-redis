'use strict';

var Promise = require('ember-cli/lib/ext/promise');

var assert  = require('ember-cli/tests/helpers/assert');

function hooks(plugin) {
  return Object.keys(plugin).filter(function(key) {
    return (key !== 'name') && (key.charAt(0) !== '_') && (typeof plugin[key] === 'function');
  });
}

var stubUi      = { write: function() {}, writeLine: function() {} };
var stubProject = {
  name: function(){
    return 'my-project';
  }
};

describe('redis plugin', function() {
  var subject;

  before(function() {
    subject = require('../../index');
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

    assert.equal(hooks(plugin).length, 4);
    assert.sameMembers(hooks(plugin), ['configure', 'upload', 'activate', 'didDeploy']);
  });

  describe('configure hook', function() {
    it('resolves if config is ok', function() {
      var plugin = subject.createDeployPlugin({
        name: 'redis'
      });

      var context = {
        deployment: {
          ui: stubUi,
          project: stubProject,
          config: {
            redis: {
              host: 'somehost',
              port: 1234
            }
          }
        }
      };

      return assert.isFulfilled(plugin.configure.call(plugin, context))
    });

    describe('resolving data from the pipeline', function() {
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
          deployment: {
            ui: stubUi,
            project: stubProject,
            config: {
              redis: config
            }
          },

          revisionKey: 'something-else'
        };

        return assert.isFulfilled(plugin.configure.call(plugin, context))
          .then(function() {
            assert.equal(config.revisionKey, '12345');
          });
      });

      it('uses the commandLineArgs value if it exists', function() {
        var plugin = subject.createDeployPlugin({
          name: 'redis'
        });

        var config = {
          host: 'somehost',
          port: 1234
        };
        var context = {
          deployment: {
            ui: stubUi,
            project: stubProject,
            config: {
              redis: config
            },
            commandLineArgs: {
              revisionKey: 'abcd'
            }
          },

          revisionKey: 'something-else'
        };

        return assert.isFulfilled(plugin.configure.call(plugin, context))
          .then(function() {
            assert.typeOf(config.revisionKey, 'function');
            assert.equal(config.revisionKey(context), 'abcd');
          });
      })

      it('uses the context value if it exists and commandLineArgs don\'t', function() {
        var plugin = subject.createDeployPlugin({
          name: 'redis'
        });

        var config = {
          host: 'somehost',
          port: 1234
        };
        var context = {
          deployment: {
            ui: stubUi,
            project: stubProject,
            config: {
              redis: config
            },
            commandLineArgs: { }
          },

          revisionKey: 'something-else'
        };

        return assert.isFulfilled(plugin.configure.call(plugin, context))
          .then(function() {
            assert.typeOf(config.revisionKey, 'function');
            assert.equal(config.revisionKey(context), 'something-else');
          });
      })
    });
  });

  describe('upload hook', function() {
    var plugin;
    var context;

    beforeEach(function() {
      plugin = subject.createDeployPlugin({
        name: 'redis'
      });

      context = {
        redisClient: {
          upload: function(keyPrefix, revisionKey) {
            return Promise.resolve(keyPrefix + ':' + revisionKey);
          }
        },
        tag: 'some-tag',
        deployment: {
          ui: stubUi,
          project: stubProject,
          config: {
            redis: {
              keyPrefix: 'test-prefix',
              filePattern: 'tests/index.html',
              revisionKey: '123abc'
            }
          }
        },
      };
    });

    it('uploads the index', function() {
      return assert.isFulfilled(plugin.upload.call(plugin, context))
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
        tag: 'some-tag',
        deployment: {
          ui: stubUi,
          project: stubProject,
          config: {
            redis: {
              keyPrefix: 'test-prefix',
              filePattern: 'tests/index.html',
              revisionKey: '123abc'
            }
          }
        }
      };

      return assert.isFulfilled(plugin.activate.call(plugin, context))
        .then(function() {
          assert.ok(activateCalled);
          assert.equal(context.activatedRevisionKey, '123abc');
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
        tag: 'some-tag',
        deployment: {
          ui: stubUi,
          project: stubProject,
          config: {
            redis: {
              keyPrefix: 'test-prefix',
              filePattern: 'tests/index.html',
              revisionKey: '123abc'
            }
          }
        }
      };

      return assert.isRejected(plugin.activate.call(plugin, context))
        .then(function(error) {
          assert.equal(error, 'some-error');
        });
    });
  });
  describe('didDeploy hook', function() {
    it('prints default message about lack of activation when revision has not been activated', function() {
      var messageOutput = "";

      var plugin = subject.createDeployPlugin({
        name: 'redis'
      });
      plugin.upload = function(){};
      plugin.activate = function(){};

      var context = {
        deployment: {
          deployEnvironment: 'qa',
          ui: {
            write: function(message){
              messageOutput = messageOutput + message;
            },
            writeLine: function(message){
              messageOutput = messageOutput + message + "\n";
            }
          },
          project: stubProject,
          config: {
            redis: {
              revisionKey: '123abc',
              activatedRevisionKey: null
            }
          }
        },
        revisionKey: '123abc',
      };

      return assert.isFulfilled(plugin.configure.call(plugin, context)).then(function(){
        return assert.isFulfilled(plugin.didDeploy.call(plugin, context));
      }).then(function() {
        assert.match(messageOutput, /Deployed but did not activate revision 123abc./);
        assert.match(messageOutput, /To activate, run/);
        assert.match(messageOutput, /ember activate 123abc --environment=qa/);
      });
    });
  });
});
