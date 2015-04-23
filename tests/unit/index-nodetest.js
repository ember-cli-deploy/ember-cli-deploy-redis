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

    assert.equal(typeof result.upload, 'function');
  });

  describe('upload hook', function() {
    it('uploads the index to redis', function() {
      var plugin = subject.createDeployPlugin({
        name: 'test-plugin'
      });

      var context = {
        redisClient: {
          upload: function() {
            return Promise.resolve('redis-key');
          }
        },
        tag: 'some-tag',
        indexPath: 'tests/index.html',
        deployment: {
          ui: { write: function() {} },
          project: { name: function() { return 'test-project'; } },
          config: {}
        }
      };

      return assert.isFulfilled(plugin.upload.call(plugin, context))
        .then(function(result) {
          assert.deepEqual(result, { redisKey: 'redis-key' });
        });
    });

    it('returns the uploaded key', function() {
    });
  });
});
