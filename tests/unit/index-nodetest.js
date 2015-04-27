'use strict';

var Promise = require('ember-cli/lib/ext/promise');

var assert  = require('ember-cli/tests/helpers/assert');

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
    var result = subject.createDeployPlugin({
      name: 'test-plugin'
    });

    assert.equal(typeof result.willDeploy, 'function');
    assert.equal(typeof result.upload, 'function');
  });

  describe('willDeploy hook', function() {
    it('resolves if config is ok', function() {
      var plugin = subject.createDeployPlugin({
        name: 'redis'
      });

      var context = {
        deployment: {
          ui: { write: function() {}, writeLine: function() {} },
          config: {
            redis: {
              host: 'somehost',
              port: 1234
            }
          }
        }
      };

      return assert.isFulfilled(plugin.willDeploy.call(plugin, context))
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
          upload: function() {
            return Promise.resolve('redis-key');
          }
        },
        tag: 'some-tag',
        deployment: {
          ui: { write: function() {} },
          project: { name: function() { return 'test-project'; } },
          config: {
            redis: {
              filePattern: 'tests/index.html',
            }
          }
        }
      };
    });

    it('uploads the index to redis', function() {
      return assert.isFulfilled(plugin.upload.call(plugin, context))
        .then(function(result) {
          assert.deepEqual(result, { redisKey: 'redis-key' });
        });
    });

    it('returns the uploaded key', function() {
      return assert.isFulfilled(plugin.upload.call(plugin, context))
        .then(function(result) {
          assert.deepEqual(result.redisKey, 'redis-key');
        });
    });
  });
});
