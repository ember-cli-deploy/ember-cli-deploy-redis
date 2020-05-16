'use strict';

var IoredisMock = require('ioredis-mock');

var RSVP = require('rsvp');
var assert = require('../../helpers/assert');
var sandbox = require('sinon').createSandbox();

describe('redis', function () {
  var Redis;

  before(function () {
    Redis = require('../../../lib/redis');
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('#upload', function () {
    it('rejects if the key already exists in redis', async function () {
      var redis = new Redis({}, IoredisMock);

      await redis.upload('key', 'value');
      let promise = redis.upload('key', 'value');
      assert.isRejected(promise, /^Value already exists for key: key:default$/);
    });

    it('uploads the contents if the key does not already exist', async function () {
      var redis = new Redis({}, IoredisMock);

      let promise = redis.upload('key', 'value', 'filecontents');
      await assert.isFulfilled(promise);
      let value = await redis._client.get('key:value');
      assert.equal(value, 'filecontents');
    });

    it('uploads the contents if the key already exists but allowOverwrite is true', async function () {
      var redis = new Redis({
        allowOverwrite: true
      }, IoredisMock);

      await redis.upload('key', 'value', 'firstfilecontents');
      await redis.upload('key', 'value', 'secondfilecontents');
      let value = await redis._client.get('key:value');
      assert.equal(value, 'secondfilecontents');
    });

    it('trims the list of recent uploads and removes the index key and the revisionData', async function () {
      let redis = new Redis({
        maxRecentUploads: 2
      }, IoredisMock);

        await redis.upload('key', 1, '1value');
        await redis.upload('key', 2, '2value');
        await redis.upload('key', 3, '3value');
        let values = await redis._client.mget('key:1', 'key:revision-data:1')
        assert.equal(values.filter(Boolean).length, 0, 'Expected key:1 and key:revision-data:1 to be deleted.');
        let value = await redis._client.zrange('key:revisions', 0, -1);
        assert.deepEqual(value, ['2', '3']);
    });

    it('trims the list of recent uploads but leaves the active one', async function () {
      let redis = new Redis({
        maxRecentUploads: 2
      }, IoredisMock);

      await redis.upload('key', 1, '1value');
      await redis._client.set('key:current', '1');
      await redis.upload('key', 2, '2value');
      await redis.upload('key', 3, '3value');
      await redis.upload('key', 4, '4value');
      let values = await redis._client.keys('*');
      assert.deepEqual(values, [
        'key:1',
        'key:revisions',
        'key:current',
        'key:3', // key 2 was trimmed
        'key:4'
      ]);
    });

    describe('generating the redis key', function () {
      it('will use just the default tag if the tag is not provided', async function () {
        let redis = new Redis({}, IoredisMock);

        await redis.upload('key', undefined, 'filecontents');
        let value = await redis._client.get('key:default');
        assert.equal(value, 'filecontents');
      });

      it('will use the key and the tag if the tag is provided', async function () {
        let redis = new Redis({}, IoredisMock);

        await redis.upload('key', 'tag', 'filecontents');
        let value = await redis._client.get('key:tag');
        assert.equal(value, 'filecontents');
      });
    });
  });

  describe('#willActivate', function () {
    it('sets the previous revision to the current revision', async function () {
      let redis = new Redis({}, IoredisMock);

      await redis.upload('key', '1', 'filecontents1');
      await redis.upload('key', '2', 'filecontents2');
      await redis.activate('key', '1', 'current');
      let activeRevision = await redis.activeRevision('key');
      assert.equal(activeRevision, '1');
    });
  }),

  describe('#activate', function () {
    it('rejects if the revisionKey doesn\'t exist in list of uploaded revisions', async function () {
      let redis = new Redis({}, IoredisMock);

      await redis.upload('key', '1', 'filecontents1');
      await redis.upload('key', '2', 'filecontents2');
      let promise = redis.activate('key', '3', 'current');
      await assert.isRejected(promise);
    });

    it('resolves and sets the current revision to the revision key provided', async function () {
      let redis = new Redis({}, IoredisMock);

      await redis.upload('key', '1', 'filecontents1');
      await redis.upload('key', '2', 'filecontents2');
      await redis.activate('key', '1', 'current');
      let activeRevision = await redis.activeRevision('key');
      assert.equal(activeRevision, '1');
      let keyContents = await redis._client.get('key:1');
      assert.equal(keyContents, 'filecontents1');
    });

    it('copies revision to the activeContentSuffix', async function () {
      let redis = new Redis({}, IoredisMock);

      await redis.upload('key', '1', 'filecontents1');
      await redis.upload('key', '2', 'filecontents2');
      await redis.upload('key', '3', 'filecontents3');
      await redis.activate('key', '1', 'current-id', 'current-content');
      let currentContent = await redis._client.get('key:current-content');
      assert.equal(currentContent, 'filecontents1');
      let currentId = await redis._client.get('key:current-id');
      assert.equal(currentId, '1');
    });
  });

  describe('#fetchRevisions', function () {
    it('lists the last existing revisions', async function () {
      let redis = new Redis({}, IoredisMock);

      await redis.upload('key', '1', 'filecontents1');
      await redis.upload('key', '2', 'filecontents2');
      await redis.upload('key', '3', 'filecontents3');
      let recentRevisions = await redis.fetchRevisions('key');
      assert.deepEqual(recentRevisions, [{
          revision: '3',
          active: false,
          revisionData: null
        },
        {
          revision: '2',
          active: false,
          revisionData: null
        },
        {
          revision: '1',
          active: false,
          revisionData: null
        }
      ]);
    });

    it('lists revisions and marks the active one', async function () {
      let redis = new Redis({}, IoredisMock);

      await redis.upload('key', '1', 'filecontents1');
      await redis.activate('key', '1', 'current');
      await redis.upload('key', '2', 'filecontents2');
      await redis.upload('key', '3', 'filecontents3');
      let recentRevisions = await redis.fetchRevisions('key');
      assert.deepEqual(recentRevisions, [{
          revision: '3',
          active: false,
          revisionData: null
        },
        {
          revision: '2',
          active: false,
          revisionData: null
        },
        {
          revision: '1',
          active: true,
          revisionData: null
        }
      ]);
    });

    it('retrieves revisionData', async function () {
      let redis = new Redis({}, IoredisMock);
      let revisionData = '{"revisionKey":"a","timestamp":"2016-03-13T14:25:40.563Z","scm":{"sha":"9101968710f18a6720c48bf032fd82efd5743b7d","email":"mattia@mail.com","name":"Mattia Gheda","timestamp":"2015-12-22T12:44:48.000Z","branch":"master"}}';

      await redis.upload('key', '1', revisionData, 'filecontents1');
      let revisions = await redis.fetchRevisions('key');
      assert.deepEqual(revisions, [{
        revision: '1',
        active: false,
        revisionData: revisionData
      }]);
    });

    it('uses activationSuffix in order to get the right activeRevision', async function () {
      let redis = new Redis({
        activationSuffix: 'active-key'
      }, IoredisMock);

      let redisGetStub = sandbox.stub(redis._client, 'get').returns(RSVP.Promise.resolve());

      await redis.activeRevision('key-prefix');
      assert.isTrue(redisGetStub.calledWith('key-prefix:active-key'));
    });
  });
});
