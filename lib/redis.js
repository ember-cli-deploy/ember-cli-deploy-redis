var CoreObject = require('core-object');
var Promise    = require('ember-cli/lib/ext/promise');

module.exports = CoreObject.extend({
  init: function(options, lib) {
    var redisOptions = options;
    var redisLib     = lib;

    if (options.url) {
      redisOptions = options.url;
    } else {
      redisOptions = {
        host: options.host,
        port: options.port
      };

      if (options.password) {
        redisOptions.password = options.password;
      }

      if (options.database) {
        redisOptions.database = options.database;
      }
    }

    if (!redisLib) {
      redisLib = require('then-redis');
    }

    this._client = redisLib.createClient(redisOptions);

    this._maxNumberOfRecentUploads = 10;
    this._allowOverwrite = options.allowOverwrite;
  },

  upload: function(/*keyPrefix, revisionKey, value*/) {
    var args = Array.prototype.slice.call(arguments);

    var keyPrefix   = args.shift();
    var value       = args.pop();
    var revisionKey = args[0] || 'default';
    var redisKey    = keyPrefix + ':' + revisionKey;

    var maxEntries = this._maxNumberOfRecentUploads;

    return Promise.resolve()
      .then(this._uploadIfKeyDoesNotExist.bind(this, redisKey, value))
      .then(this._updateRecentUploadsList.bind(this, keyPrefix, revisionKey))
      .then(this._trimRecentUploadsList.bind(this, keyPrefix, maxEntries))
      .then(function() {
        return redisKey;
      });
  },

  activate: function(keyPrefix, revisionKey, activationSuffix) {
    var currentKey = keyPrefix + ':' + activationSuffix;

    return Promise.resolve()
      .then(this._listRevisions.bind(this, keyPrefix))
      .then(this._validateRevisionKey.bind(this, revisionKey))
      .then(this._activateRevisionKey.bind(this, currentKey, revisionKey));
  },

  fetchRevisions: function(keyPrefix) {
    return Promise.hash({
      revisions: this._listRevisions(keyPrefix),
      current: this.activeRevision(keyPrefix)
    }).then(function(results) {
        return results.revisions.map(function(revision) {
          return {
            revision: revision,
            active: revision === results.current
          };
        });
      });
  },

  activeRevision: function(keyPrefix) {
    var currentKey = keyPrefix + ':current';
    return this._client.get(currentKey);
  },

  _listRevisions: function(keyPrefix) {
    var client = this._client;
    var listKey = keyPrefix + ':revisions';
    return client.zrevrange(listKey, 0, -1);
  },

  _validateRevisionKey: function(revisionKey, revisions) {
    return revisions.indexOf(revisionKey) > -1 ? Promise.resolve() : Promise.reject('`' + revisionKey + '` is not a valid revision key');
  },

  _activateRevisionKey: function(currentKey, revisionKey) {
    var client = this._client;
    return client.set(currentKey, revisionKey);
  },

  _uploadIfKeyDoesNotExist: function(redisKey, value) {
    var client         = this._client;
    var allowOverwrite = !!this._allowOverwrite;

    return Promise.resolve()
      .then(function() {
        return client.get(redisKey);
      })
      .then(function(value) {
        if (value && !allowOverwrite) {
          return Promise.reject('Value already exists for key: ' + redisKey);
        }
      })
      .then(function() {
        return client.set(redisKey, value);
      });
  },

  _updateRecentUploadsList: function(keyPrefix, revisionKey) {
    var client = this._client;
    var score = new Date().getTime();
    var listKey = keyPrefix + ':revisions';
    return client.zadd(listKey, score, revisionKey);
  },

  _trimRecentUploadsList: function(keyPrefix, maxEntries) {
    var client = this._client;
    var listKey = keyPrefix + ':revisions';

    return Promise.hash({
      revisionsToBeRemoved: client.zrange(listKey, 0, -(maxEntries + 1)),
      current: this.activeRevision(keyPrefix)
    }).then(function(results) {
      var revisions = results.revisionsToBeRemoved;
      var current = results.current;
      if (!revisions) {
        return;
      }
      revisions.forEach(function(revision) {
        if (revision !== current) {
          client.del(keyPrefix + ":" + revision);
          client.zrem(listKey, revision);
        }
      });
    });
  }
});
