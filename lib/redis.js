var CoreObject = require('core-object');
var RSVP = require('rsvp');

module.exports = CoreObject.extend({

  init: function(options, lib) {
    this._super();
    var redisOptions = {};
    var RedisLib     = lib;

    if (options.url) {
      redisOptions = this._stripUsernameFromConfigUrl(options.url);
    } else {
      redisOptions = {
        host: options.host,
        port: options.port
      };

      if (options.password) {
        redisOptions.password = options.password;
      }

      if (options.database) {
        redisOptions.db = options.database;
      }

      if (options.tls) {
        redisOptions.tls = options.tls
      }
    }

    if (!RedisLib) {
      RedisLib = require('ioredis');
    }

    this._client = new RedisLib(redisOptions);

    this._maxRecentUploads = options.maxRecentUploads;
    this._allowOverwrite = options.allowOverwrite;
    this._activationSuffix = options.activationSuffix || 'current';
  },

  upload: function(/*keyPrefix, revisionKey, value*/) {
    var args = Array.prototype.slice.call(arguments);

    var keyPrefix   = args.shift();
    var value       = args.pop();
    var revisionKey = args[0] || 'default';
    var revisionData = args[1];
    var redisKey    = keyPrefix + ':' + revisionKey;
    var maxEntries = this._maxRecentUploads;
    var _this = this;

    return RSVP.resolve()
      .then(this._uploadIfKeyDoesNotExist.bind(this, redisKey, value))
      .then(function() {
        if (revisionData) {
          return _this._uploadRevisionData(keyPrefix, revisionKey, revisionData);
        } else {
          return RSVP.resolve();
        }
      })
      .then(this._updateRecentUploadsList.bind(this, keyPrefix, revisionKey))
      .then(this._trimRecentUploadsList.bind(this, keyPrefix, maxEntries))
      .then(function() {
        return redisKey;
      });
  },

  activate: function(keyPrefix, revisionKey, activationSuffix, activeContentSuffix) {
    return RSVP.resolve()
      .then(this._listRevisions.bind(this, keyPrefix))
      .then(this._validateRevisionKey.bind(this, revisionKey))
      .then(this._activateRevision.bind(this, keyPrefix, revisionKey, activationSuffix, activeContentSuffix));
  },

  fetchRevisions: function(keyPrefix) {
    var _this = this;
    return this._listRevisions(keyPrefix).then(function(revisions) {
      return RSVP.hash({
        revisions: RSVP.resolve(revisions),
        current: _this.activeRevision(keyPrefix),
        revisionData: _this._revisionData(keyPrefix, revisions)
      });
    }).then(function(results) {
      return results.revisions.map(function(revision, i) {
        var hash = {
          revision: revision,
          active: revision === results.current,
        };
        if (results.revisionData) {
          hash.revisionData = results.revisionData[i];
        }
        return hash;
      });
    });
  },

  activeRevision: function(keyPrefix) {
    var currentKey = keyPrefix + ':' + this._activationSuffix;
    return this._client.get(currentKey);
  },

  _revisionData: function(keyPrefix, revisions) {
    if (revisions.length === 0) {
      return RSVP.resolve();
    }
    var dataKeys = revisions.map(function(revision) {
      return keyPrefix + ':revision-data:' + revision;
    });

    return this._client.mget(dataKeys).then(function(data) {
      if (!data) {
        return RSVP.resolve();
      }
      return data.map(function(d) {
        return JSON.parse(d);
      });
    });
  },

  _listRevisions: function(keyPrefix) {
    var client = this._client;
    var listKey = keyPrefix + ':revisions';
    return client.zrevrange(listKey, 0, -1);
  },

  _validateRevisionKey: function(revisionKey, revisions) {
    return revisions.indexOf(revisionKey) > -1 ? RSVP.resolve() : RSVP.reject('`' + revisionKey + '` is not a valid revision key');
  },

  _activateRevisionKey: function(keyPrefix, revisionKey, activationSuffix) {
    var currentKey = keyPrefix + ':' + activationSuffix;

    return this._client.set(currentKey, revisionKey);
  },

  _activateRevision: function(keyPrefix, revisionKey, activationSuffix, activeContentSuffix) {
    if (activeContentSuffix) {
      return this._copyRevisionAndActivateRevisionKey(keyPrefix, revisionKey, activationSuffix, activeContentSuffix);
    }

    return this._activateRevisionKey(keyPrefix, revisionKey, activationSuffix);
  },

  _copyRevisionAndActivateRevisionKey: function(keyPrefix, revisionKey, activationSuffix, activeContentSuffix) {
    var client = this._client;
    var _this  = this;
    var activeContentKey = keyPrefix + ':' + activeContentSuffix;
    var revisionContentKey = keyPrefix + ':' + revisionKey;

    return new RSVP.Promise(function(resolve, reject) {
      client.get(revisionContentKey).then(
        function(value) {
          client.set(activeContentKey, value).then(function() {
            _this._activateRevisionKey(keyPrefix, revisionKey, activationSuffix).then(resolve, reject);
          });
        },
        reject
      );
    });
  },

  _uploadIfKeyDoesNotExist: function(redisKey, value) {
    var client         = this._client;
    var allowOverwrite = !!this._allowOverwrite;

    return RSVP.resolve()
      .then(function() {
        return client.get(redisKey);
      })
      .then(function(value) {
        if (value && !allowOverwrite) {
          return RSVP.reject('Value already exists for key: ' + redisKey);
        }
      })
      .then(function() {
        return client.set(redisKey, value);
      });
  },

  _uploadRevisionData: function(keyPrefix, revisionKey, revisionData) {
    var client = this._client;
    var redisKey = keyPrefix + ':revision-data:' + revisionKey;
    return RSVP.resolve()
      .then(function() {
        return client.set(redisKey, JSON.stringify(revisionData));
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

    return RSVP.hash({
      revisionsToBeRemoved: client.zrange(listKey, 0, -(maxEntries + 1)),
      current: this.activeRevision(keyPrefix)
    }).then(function(results) {
      var revisions = results.revisionsToBeRemoved;
      var current = results.current;
      if (!revisions) {
        return;
      }
      var promises = [];
      revisions.forEach(function(revision) {
        if (revision !== current) {
          promises.push(client.del(keyPrefix + ":" + revision));
          promises.push(client.del(keyPrefix + ":revision-data:" + revision));
          promises.push(client.zrem(listKey, revision));
        }
      });

      return RSVP.all(promises);
    });
  },

  _stripUsernameFromConfigUrl: function(configUrl) {
    var regex = /redis:\/\/(\w+):(\w+)(.*)/;
    var matches = configUrl.match(regex);

    if (matches) {
      configUrl = 'redis://:' + matches[2] + matches[3];
    }

    return configUrl;
  }
});
