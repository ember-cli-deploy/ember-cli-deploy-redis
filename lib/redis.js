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

  upload: function(/*key, tag, value*/) {
    var args = Array.prototype.slice.call(arguments);

    var key      = args.shift();
    var value    = args.pop();
    var tag      = args[0] || 'default';
    var redisKey = key + ':' + tag;

    var maxEntries = this._maxNumberOfRecentUploads;

    return Promise.resolve()
      .then(this._uploadIfKeyDoesNotExist.bind(this, redisKey, value))
      .then(this._updateRecentUploadsList.bind(this, key, tag))
      .then(this._trimRecentUploadsList.bind(this, key, maxEntries))
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

  _updateRecentUploadsList: function(key, tag) {
    var client = this._client;
    return client.lpush(key, tag);
  },

  _trimRecentUploadsList: function(key, maxEntries) {
    var client = this._client;
    return client.ltrim(key, 0, maxEntries - 1);
  }
});
