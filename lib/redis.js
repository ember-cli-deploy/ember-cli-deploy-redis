var CoreObject = require('core-object');
var Promise    = require('ember-cli/lib/ext/promise');

module.exports = CoreObject.extend({
  init: function(options) {
    if (options.redisClient) {
      this._client = options.redisClient;
    } else if (options.url) {
      this._client = require('then-redis').createClient(options.url);
    } else {
      var redisOptions = {
        host: options.host,
        port: options.port
      };

      if (options.password) {
        redisOptions.password = options.password;
      }

      this._client = require('then-redis').createClient(redisOptions);
    }
    this._maxNumberOfRecentUploads = 10;
    this._allowOverwrite = options.allowOverwrite;
  },

  upload: function(/*keyPrefix, tag, value*/) {
    var args = Array.prototype.slice.call(arguments);

    var keyPrefix      = args.shift();
    var value    = args.pop();
    var tag      = args[0] || 'default';
    var redisKey = keyPrefix + ':' + tag;

    var maxEntries = this._maxNumberOfRecentUploads;

    return Promise.resolve()
      .then(this._uploadIfKeyDoesNotExist.bind(this, redisKey, value))
      .then(this._updateRecentUploadsList.bind(this, keyPrefix, tag))
      .then(this._trimRecentUploadsList.bind(this, keyPrefix, maxEntries))
      .then(function() {
        return redisKey;
      });
  },

  _uploadIfKeyDoesNotExist: function(redisKey, value) {
    var client = this._client;
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
      })
  },

  _updateRecentUploadsList: function(keyPrefix, tag) {
    var client = this._client;
    return client.lpush(keyPrefix, tag);
  },

  _trimRecentUploadsList: function(keyPrefix, maxEntries) {
    var client = this._client;
    return client.ltrim(keyPrefix, 0, maxEntries - 1);
  }
});
