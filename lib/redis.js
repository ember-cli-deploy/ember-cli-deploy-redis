var CoreObject = require('core-object');
var RSVP = require('rsvp');

module.exports = CoreObject.extend({

  init(options, lib) {
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
    }

    if (!RedisLib) {
      RedisLib = require('ioredis');
    }

    this._client = new RedisLib(redisOptions);

    this._maxRecentUploads = options.maxRecentUploads;
    this._allowOverwrite = options.allowOverwrite;
    this._activationSuffix = options.activationSuffix || 'current';
  },

  async upload(/*keyPrefix, revisionKey, value*/) {
    let args = Array.prototype.slice.call(arguments);

    let keyPrefix    = args.shift();
    let value        = args.pop();
    let revisionKey  = args[0] || 'default';
    let revisionData = args[1];
    let redisKey     = `${keyPrefix}:${revisionKey}`;
    let maxEntries   = this._maxRecentUploads;

    await this._uploadIfKeyDoesNotExist(redisKey, value);
    if (revisionData) {
      await this._uploadRevisionData(keyPrefix, revisionKey, revisionData);
    }
    await this._updateRecentUploadsList(keyPrefix, revisionKey);
    await this._trimRecentUploadsList(keyPrefix, maxEntries);
    return redisKey;
  },

  async activate(keyPrefix, revisionKey, activationSuffix, activeContentSuffix) {
    let revisions = await this._listRevisions(keyPrefix);
    this._validateRevisionKey(revisionKey, revisions);
    await this._activateRevision(keyPrefix, revisionKey, activationSuffix, activeContentSuffix);
  },

  async fetchRevisions(keyPrefix) {
    let revisions = await this._listRevisions(keyPrefix);
    let results = await RSVP.hash({
      current: this.activeRevision(keyPrefix),
      revisionData: this._revisionData(keyPrefix, revisions)
    });
    return revisions.map(function(revision, i) {
      let hash = {
        revision: revision,
        active: revision === results.current,
      };
      if (results.revisionData) {
        hash.revisionData = results.revisionData[i];
      }
      return hash;
    });
  },

  activeRevision(keyPrefix) {
    var currentKey = keyPrefix + ':' + this._activationSuffix;
    return this._client.get(currentKey);
  },

  async _revisionData(keyPrefix, revisions) {
    if (revisions.length === 0) {
      return;
    }
    let dataKeys = revisions.map((rev) => `${keyPrefix}:revision-data:${rev}`);

    let data = this._client.mget(dataKeys);
    if (!data) {
      return;
    }
    return data.map((d) => JSON.parse(d));
  },

  _listRevisions(keyPrefix) {
    let client = this._client;
    let listKey = `${keyPrefix}:revisions`;
    return client.zrevrange(listKey, 0, -1);
  },

  _validateRevisionKey(revisionKey, revisions) {
    if (revisions.indexOf(revisionKey) === -1) {
      throw new Error(`\`${revisionKey}\` is not a valid revision key`);
    }
    return;
  },

  _activateRevisionKey(keyPrefix, revisionKey, activationSuffix) {
    let currentKey = `${keyPrefix}:${activationSuffix}`;
    return this._client.set(currentKey, revisionKey);
  },

  _activateRevision(keyPrefix, revisionKey, activationSuffix, activeContentSuffix) {
    if (activeContentSuffix) {
      return this._copyRevisionAndActivateRevisionKey(keyPrefix, revisionKey, activationSuffix, activeContentSuffix);
    }

    return this._activateRevisionKey(keyPrefix, revisionKey, activationSuffix);
  },

  async _copyRevisionAndActivateRevisionKey(keyPrefix, revisionKey, activationSuffix, activeContentSuffix) {
    let client = this._client;
    let activeContentKey = `${keyPrefix}:${activeContentSuffix}`;
    let revisionContentKey = `${keyPrefix}:${revisionKey}`;

    let value = await client.get(revisionContentKey);
    await client.set(activeContentKey, value);
    await this._activateRevisionKey(keyPrefix, revisionKey, activationSuffix);
  },

  async _uploadIfKeyDoesNotExist(redisKey, value) {
    let client         = this._client;
    let allowOverwrite = !!this._allowOverwrite;

    let existingValue = await client.get(redisKey);
    if (existingValue && !allowOverwrite) {
      throw new Error(`Value already exists for key: ${redisKey}`);
    }
    return client.set(redisKey, value);
  },

  async _uploadRevisionData(keyPrefix, revisionKey, revisionData) {
    let client = this._client;
    let redisKey = `${keyPrefix}:revision-data:${revisionKey}`;
    await client.set(redisKey, JSON.stringify(revisionData));
  },

  async _updateRecentUploadsList(keyPrefix, revisionKey) {
    let client = this._client;
    let score = new Date().getTime();
    let listKey = `${keyPrefix}:revisions`;
    await client.zadd(listKey, score, revisionKey);
  },

  async _trimRecentUploadsList(keyPrefix, maxEntries) {
    let client = this._client;
    let listKey = `${keyPrefix}:revisions`;

    let results = await RSVP.hash({
      revisionsToBeRemoved: client.zrange(listKey, 0, -(maxEntries + 1)),
      current: this.activeRevision(keyPrefix)
    });
    let revisions = results.revisionsToBeRemoved;
    let current = results.current;
    if (!revisions) {
      return;
    }
    let promises = [];
    revisions.forEach(function(revision) {
      if (revision !== current) {
        promises.push(client.del(`${keyPrefix}:${revision}`));
        promises.push(client.del(`${keyPrefix}:revision-data:${revision}`));
        promises.push(client.zrem(listKey, revision));
      }
    });
    await RSVP.all(promises);
  },

  _stripUsernameFromConfigUrl(configUrl) {
    var regex = /redis:\/\/(\w+):(\w+)(.*)/;
    var matches = configUrl.match(regex);

    if (matches) {
      configUrl = 'redis://:' + matches[2] + matches[3];
    }

    return configUrl;
  }
});
