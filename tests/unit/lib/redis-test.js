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
    it('rejects if the key already exists in redis', function () {
      var redis = new Redis({}, IoredisMock);

      return redis.upload('key', 'value').then(() => {
        var promise = redis.upload('key', 'value');
        assert.isRejected(promise, /^Value already exists for key: key:default$/);
      });
    });

    it('uploads the contents if the key does not already exist', function () {
      var redis = new Redis({}, IoredisMock);

      var promise = redis.upload('key', 'value', 'filecontents');
      return assert.isFulfilled(promise).then(() => {
        return redis._client.get('key:value');
      }).then((value) => {
        assert.equal(value, 'filecontents');
      });
    });

    it('uploads the contents if the key already exists but allowOverwrite is true', function () {
      var redis = new Redis({
        allowOverwrite: true
      }, IoredisMock);

      return redis.upload('key', 'value', 'firstfilecontents').then(() => {
        return redis.upload('key', 'value', 'secondfilecontents');
      }).then(() => {
        return redis._client.get('key:value');
      }).then((value) => {
        assert.equal(value, 'secondfilecontents');
      });
    });

    it('trims the list of recent uploads and removes the index key and the revisionData', function () {
      var redis = new Redis({
        maxRecentUploads: 2
      }, IoredisMock);

      return RSVP.resolve()
        .then(() => {
          return redis.upload('key', 1, '1value');
        })
        .then(() => {
          return redis.upload('key', 2, '2value');
        })
        .then(() => {
          return redis.upload('key', 3, '3value');
        })
        .then(() => {
          return redis._client.mget('key:1', 'key:revision-data:1')
        })
        .then((values) => {
          assert.equal(values.filter(Boolean).length, 0, 'Expected key:1 and key:revision-data:1 to be deleted.');
          return redis._client.zrange('key:revisions', 0, -1);
        })
        .then((value) => {
          assert.deepEqual(value, ['2', '3']);
        });
    });

    it('trims the list of recent uploads but leaves the active one', function () {
      var redis = new Redis({
        maxRecentUploads: 2
      }, IoredisMock);

      return RSVP.resolve()
        .then(() => {
          return redis.upload('key', 1, '1value');
        })
        .then(() => {
          return redis._client.set('key:current', '1');
        })
        .then(() => {
          return redis.upload('key', 2, '2value');
        })
        .then(() => {
          return redis.upload('key', 3, '3value');
        })
        .then(() => {
          return redis.upload('key', 4, '4value');
        })
        .then(() => {
          return redis._client.keys('*');
        })
        .then((values) => {
          assert.deepEqual(values, [
            'key:1',
            'key:revisions',
            'key:current',
            'key:3', // key 2 was trimmed
            'key:4'
          ]);
        });
    });

    describe('generating the redis key', function () {
      it('will use just the default tag if the tag is not provided', function () {
        var redis = new Redis({}, IoredisMock);

        return RSVP.resolve()
          .then(() => {
            return redis.upload('key', undefined, 'filecontents');
          })
          .then(() => {
            return redis._client.get('key:default');
          })
          .then((value) => {
            assert.equal(value, 'filecontents');
          });
      });

      it('will use the key and the tag if the tag is provided', function () {
        var redis = new Redis({}, IoredisMock);

        return RSVP.resolve()
          .then(() => {
            return redis.upload('key', 'tag', 'filecontents');
          })
          .then(() => {
            return redis._client.get('key:tag');
          })
          .then((value) => {
            assert.equal(value, 'filecontents');
          });
      });
    });
  });

  describe('#willActivate', function () {
      it('sets the previous revision to the current revision', function () {
        var redis = new Redis({}, IoredisMock);

        return RSVP.resolve()
          .then(() => {
            return redis.upload('key', '1', 'filecontents1');
          })
          .then(() => {
            return redis.upload('key', '2', 'filecontents2');
          })
          .then(() => {
            return redis.activate('key', '1', 'current');
          })
          .then(() => {
            return redis.activeRevision('key');
          })
          .then((activeRevision) => {
            assert.equal(activeRevision, '1');
          });
      });
    }),

    describe('#activate', function () {
      it('rejects if the revisionKey doesn\'t exist in list of uploaded revisions', function () {
        var redis = new Redis({}, IoredisMock);

        return RSVP.resolve()
          .then(() => {
            return redis.upload('key', '1', 'filecontents1');
          })
          .then(() => {
            return redis.upload('key', '2', 'filecontents2');
          })
          .then(() => {
            var promise = redis.activate('key', '3', 'current');
            return assert.isRejected(promise);
          })
      });

      it('resolves and sets the current revision to the revision key provided', function () {
        var redis = new Redis({}, IoredisMock);

        return RSVP.resolve()
          .then(() => {
            return redis.upload('key', '1', 'filecontents1');
          })
          .then(() => {
            return redis.upload('key', '2', 'filecontents2');
          })
          .then(() => {
            return redis.activate('key', '1', 'current');
          })
          .then(() => {
            return redis.activeRevision('key');
          })
          .then((activeRevision) => {
            assert.equal(activeRevision, '1');
            return redis._client.get('key:1');
          }).then((keyContents) => {
            assert.equal(keyContents, 'filecontents1');
          });
      });

      it('copies revision to the activeContentSuffix', function () {
        var redis = new Redis({}, IoredisMock);

        return RSVP.resolve()
          .then(() => {
            return redis.upload('key', '1', 'filecontents1');
          })
          .then(() => {
            return redis.upload('key', '2', 'filecontents2');
          })
          .then(() => {
            return redis.upload('key', '3', 'filecontents3');
          })
          .then(() => {
            return redis.activate('key', '1', 'current-id', 'current-content');
          })
          .then(() => {
            return redis._client.get('key:current-content');
          })
          .then((currentContent) => {
            assert.equal(currentContent, 'filecontents1');
            return redis._client.get('key:current-id');
          }).then((currentId) => {
            assert.equal(currentId, '1');
          });
      });
    });

  describe('#fetchRevisions', function () {
    it('lists the last existing revisions', function () {
      var redis = new Redis({}, IoredisMock);

      return RSVP.resolve()
        .then(() => {
          return redis.upload('key', '1', 'filecontents1');
        })
        .then(() => {
          return redis.upload('key', '2', 'filecontents2');
        })
        .then(() => {
          return redis.upload('key', '3', 'filecontents3');
        })
        .then(() => {
          return redis.fetchRevisions('key');
        })
        .then((recentRevisions) => {
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
    });

    it('lists revisions and marks the active one', function () {
      var redis = new Redis({}, IoredisMock);

      return RSVP.resolve()
        .then(() => {
          return redis.upload('key', '1', 'filecontents1');
        })
        .then(() => {
          return redis.activate('key', '1', 'current');
        })
        .then(() => {
          return redis.upload('key', '2', 'filecontents2');
        })
        .then(() => {
          return redis.upload('key', '3', 'filecontents3');
        })
        .then(() => {
          return redis.fetchRevisions('key');
        })
        .then((recentRevisions) => {
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
    });

    it('retrieves revisionData', function () {
      var redis = new Redis({}, IoredisMock);
      var revisionData = '{"revisionKey":"a","timestamp":"2016-03-13T14:25:40.563Z","scm":{"sha":"9101968710f18a6720c48bf032fd82efd5743b7d","email":"mattia@mail.com","name":"Mattia Gheda","timestamp":"2015-12-22T12:44:48.000Z","branch":"master"}}';

      return RSVP.resolve()
        .then(() => {
          return redis.upload('key', '1', revisionData, 'filecontents1');
        })
        .then(() => {
          return redis.fetchRevisions('key');
        })
        .then((revisions) => {
          assert.deepEqual(revisions, [{
            revision: '1',
            active: false,
            revisionData: revisionData
          }]);
        });
    });

    it('uses activationSuffix in order to get the right activeRevision', function () {
      var redis = new Redis({
        activationSuffix: 'active-key'
      }, IoredisMock);

      var redisGetStub = sandbox.stub(redis._client, 'get').returns(RSVP.Promise.resolve());

      return RSVP.resolve()
        .then(() => {
          return redis.activeRevision('key-prefix');
        })
        .then(() => {
          assert.isTrue(redisGetStub.calledWith('key-prefix:active-key'));
        });
    });
  });
});
