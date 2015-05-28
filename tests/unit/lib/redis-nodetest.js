'use strict';

var Promise = require('ember-cli/lib/ext/promise');
var assert  = require('ember-cli/tests/helpers/assert');

describe('redis', function() {
  var Redis;

  before(function() {
    Redis = require('../../../lib/redis');
  });

  describe('#upload', function() {
    it('rejects if the key already exists in redis', function() {
      var redis = new Redis({
        redisClient: {
          get: function(key) {
            return Promise.resolve('some-other-value');
          },
          set: function() { },
          lpush: function() { },
          ltrim: function() { }
        }
      });

      var promise = redis.upload('key', 'value');
      return assert.isRejected(promise, /^Value already exists for key: key:default$/);
    });

    it('uploads the contents if the key does not already exist', function() {
      var fileUploaded = false;

      var redis = new Redis({
        redisClient: {
          get: function(key) {
            return Promise.resolve(null);
          },
          set: function(key, value) {
            fileUploaded = true;
          },
          lpush: function() { },
          ltrim: function() { }
        }
      });

      var promise = redis.upload('key', 'value');
      return assert.isFulfilled(promise)
        .then(function() {
          assert.ok(fileUploaded);
        });
    });

    it('uploads the contents if the key already exists but allowOverwrite is true', function() {
      var fileUploaded = false;

      var redis = new Redis({
        allowOverwrite: true,
        redisClient: {
          get: function(key) {
            return Promise.resolve('some-other-value');
          },
          set: function(key, value) {
            fileUploaded = true;
          },
          lpush: function() { },
          ltrim: function() { }
        }
      });

      var promise = redis.upload('key', 'value');
      return assert.isFulfilled(promise)
        .then(function() {
          assert.ok(fileUploaded);
        });
    });

    it('updates the list of recent uploads once upload is successful', function() {
      var recentUploads = [];

      var redis = new Redis({
        redisClient: {
          get: function(key) {
            return Promise.resolve(null);
          },
          set: function(key, value) {
          },
          lpush: function(key, tag) {
            recentUploads.push(key + tag);
          },
          ltrim: function() { }
        }
      });

      var promise = redis.upload('key', 'value');
      return assert.isFulfilled(promise)
        .then(function() {
          assert.equal(recentUploads.length, 1);
          assert.equal(recentUploads[0], 'keydefault');
        });
    });

    it('trims the list of recent uploads', function() {
      var recentUploads = ['a', 'b', 'c'];

      var redis = new Redis({
        redisClient: {
          get: function(key) {
            return Promise.resolve(null);
          },
          set: function(key, value) {
          },
          lpush: function(key, tag) {
            recentUploads.push(key + tag);
          },
          ltrim: function() {
            recentUploads.pop();
          }
        }
      });

      var promise = redis.upload('key', 'value');
      return assert.isFulfilled(promise)
        .then(function() {
          assert.equal(recentUploads.length, 3);
        });
    });

    describe('generating the redis key', function() {
      it('will use just the default tag if the tag is not provided', function() {
        var redisKey = null;
        var redis = new Redis({
          redisClient: {
            get: function(key) {
              redisKey = key;
              return Promise.resolve('some-other-value');
            },
            set: function() { },
            lpush: function() { },
            ltrim: function() { }
          }
        });

        var promise = redis.upload('key', 'value');
        return assert.isRejected(promise)
          .then(function() {
            assert.equal(redisKey, 'key:default');
          })
      });

      it('will use the key and the tag if the tag is provided', function() {
        var redisKey = null;
        var redis = new Redis({
          redisClient: {
            get: function(key) {
              redisKey = key;
              return Promise.resolve('some-other-value');
            },
            set: function() { },
            lpush: function() { },
            ltrim: function() { }
          }
        });

        var promise = redis.upload('key', 'tag', 'value');
        return assert.isRejected(promise)
          .then(function() {
            assert.equal(redisKey, 'key:tag');
          })
      });
    });
  });
});
