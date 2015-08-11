'use strict';

var FakeRedis = require('../../helpers/fake-redis-lib');
var FakeClient = require('../../helpers/fake-redis-client');


var Promise = require('ember-cli/lib/ext/promise');
var assert  = require('ember-cli/tests/helpers/assert');
var CoreObject = require('core-object');

describe('redis', function() {
  var Redis;

  before(function() {
    Redis = require('../../../lib/redis');
  });

  describe('#upload', function() {
    it('rejects if the key already exists in redis', function() {
      var redis = new Redis({}, new FakeRedis());

      var promise = redis.upload('key', 'value');
      return assert.isRejected(promise, /^Value already exists for key: key:default$/);
    });

    it('uploads the contents if the key does not already exist', function() {
      var fileUploaded = false;

      var redis = new Redis({}, new FakeRedis(FakeClient.extend({
        get: function(key) {
          return Promise.resolve(null);
        },
        set: function(key, value) {
          fileUploaded = true;
        },
        zadd: function(key, score, tag) {
        },
        zremrangebyrank: function() {
        }
      })));

      var promise = redis.upload('key', 'value');
      return assert.isFulfilled(promise)
        .then(function() {
          assert.ok(fileUploaded);
        });
    });

    it('uploads the contents if the key already exists but allowOverwrite is true', function() {
      var fileUploaded = false;

      var redis = new Redis({
        allowOverwrite: true
      }, new FakeRedis(FakeClient.extend({
        set: function(key, value) {
          fileUploaded = true;
        },
        zadd: function(key, score, tag) {
        },
        zremrangebyrank: function() {
        }
      })));

      var promise = redis.upload('key', 'value');
      return assert.isFulfilled(promise)
        .then(function() {
          assert.ok(fileUploaded);
        });
    });

    it('updates the list of recent uploads once upload is successful', function() {
      var recentUploads = [];

      var redis = new Redis({}, new FakeRedis(FakeClient.extend({
        get: function(key) {
          return Promise.resolve(null);
        },
        zadd: function(key, score , tag) {
          recentUploads.push(key + tag);
        },
        zremrangebyrank: function() {
        }
      })));

      var promise = redis.upload('key', 'value');
      return assert.isFulfilled(promise)
        .then(function() {
          assert.equal(recentUploads.length, 1);
          assert.equal(recentUploads[0], 'keydefault');
        });
    });

    it('trims the list of recent uploads', function() {
      var recentUploads = ['a', 'b', 'c'];

      var redis = new Redis({}, new FakeRedis(FakeClient.extend({
        get: function(key) {
          return Promise.resolve(null);
        },
        zadd: function(key, tag) {
          recentUploads.push(key + tag);
        },
        zremrangebyrank: function() {
          recentUploads.pop();
        }
      })));

      var promise = redis.upload('key', 'value');
      return assert.isFulfilled(promise)
        .then(function() {
          assert.equal(recentUploads.length, 3);
        });
    });

    describe('generating the redis key', function() {
      it('will use just the default tag if the tag is not provided', function() {
        var redisKey = null;

        var redis = new Redis({}, new FakeRedis(FakeClient.extend({
          get: function(key) {
              redisKey = key;
              return Promise.resolve('some-other-value');
          }
        })));

        var promise = redis.upload('key', 'value');
        return assert.isRejected(promise)
          .then(function() {
            assert.equal(redisKey, 'key:default');
          })
      });

      it('will use the key and the tag if the tag is provided', function() {
        var redisKey = null;
        var redis = new Redis({}, new FakeRedis(FakeClient.extend({
          get: function(key) {
              redisKey = key;
              return Promise.resolve('some-other-value');
            }
        })));

        var promise = redis.upload('key', 'tag', 'value');
        return assert.isRejected(promise)
          .then(function() {
            assert.equal(redisKey, 'key:tag');
          })
      });
    });
  });

  describe('#activate', function() {
    it('rejects if the revisionKey doesn\t exist in list of uploaded revisions', function() {
      var recentRevisions = ['a', 'b', 'c'];

      var redis = new Redis({}, new FakeRedis(FakeClient.extend({
        zrevrange: function() {
          return recentRevisions;
        }
      })));

      var promise = redis.activate('key-prefix', 'revision-key');
      return assert.isRejected(promise)
        .then(function(error) {
          assert.equal(error, '`revision-key` is not a valid revision key');
        });
    });

    it('resolves and sets the current revision to the revision key provided', function() {
      var recentRevisions = ['a', 'b', 'c'];
      var redisKey, redisValue;


      var redis = new Redis({}, new FakeRedis(FakeClient.extend({
        zrevrange: function() {
          return recentRevisions;
        },
        set: function(key, value) {
          redisKey = key;
          redisValue = value;
        }
      })));

      var promise = redis.activate('key-prefix', 'c');
      return assert.isFulfilled(promise)
        .then(function() {
          assert.equal(redisKey, 'key-prefix:current');
          assert.equal(redisValue, 'c');
        });
    });
  });

  describe('#fetchRevisions', function() {
    it('lists the last existing revisions', function() {
      var recentRevisions = ['a', 'b', 'c'];

      var redis = new Redis({}, new FakeRedis(FakeClient.extend({
        lrange: function() {
          return recentRevisions;
        },
        get: function() {
        }
      })));

      var promise = redis.fetchRevisions('key-prefix');
      return assert.isFulfilled(promise)
        .then(function(result) {
          assert.deepEqual(result, [
            {
              revision: 'a',
              active: false
            },
            {
              revision: 'b',
              active: false
            },
            {
              revision: 'c',
              active: false
            }
          ]
        );
      });
    });

    it('lists revisions and marks the active one', function() {
      var recentRevisions = ['a', 'b'];
      var currentRevision = 'b';

      var redis = new Redis({}, new FakeRedis(FakeClient.extend({
        lrange: function() {
          return recentRevisions;
        },
        get: function() {
          return currentRevision;
        }
      })));

      var promise = redis.fetchRevisions('key-prefix');
      return assert.isFulfilled(promise)
        .then(function(result) {
          assert.deepEqual(result, [
            {
              revision: 'a',
              active: false
            },
            {
              revision: 'b',
              active: true
            }
          ]
        );
      });
    });
  });
});
