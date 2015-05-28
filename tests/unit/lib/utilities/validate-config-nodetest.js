var assert = require('ember-cli/tests/helpers/assert');

describe('validate-config', function() {
  var subject;
  var config;
  var mockUi;

  before(function() {
    subject = require('../../../../lib/utilities/validate-config');
  });

  beforeEach(function() {
    mockUi = {
      messages: [],
      write: function() { },
      writeLine: function(message) {
        this.messages.push(message);
      }
    };
  });

  describe('without providing config', function () {
    beforeEach(function() {
      config = { };
    });
    it('warns about missing optional config', function() {
      return assert.isFulfilled(subject(mockUi, config))
        .then(function() {
          var messages = mockUi.messages.reduce(function(previous, current) {
            if (/- Missing config:\s.*, using default:\s/.test(current)) {
              previous.push(current);
            }

            return previous;
          }, []);

          assert.equal(messages.length, 3);
        });
    });

    it('adds default config to the config object', function() {
      return assert.isFulfilled(subject(mockUi, config))
        .then(function() {
          assert.isDefined(config.host);
          assert.isDefined(config.port);
        });
    });

    it('resolves', function() {
      return assert.isFulfilled(subject(mockUi, config));
    })
  });

  describe('with a url provided', function () {
    beforeEach(function() {
      config = {
        url: 'redis://localhost:6379'
      };
    });
    it('only warns about missing optional filePattern', function() {
      return assert.isFulfilled(subject(mockUi, config))
        .then(function() {
          var messages = mockUi.messages.reduce(function(previous, current) {
            if (/- Missing config:\s.*, using default:\s/.test(current)) {
              previous.push(current);
            }

            return previous;
          }, []);

          assert.equal(messages.length, 1);
        });
    });

    it('does not add default config to the config object', function() {
      return assert.isFulfilled(subject(mockUi, config))
        .then(function() {
          assert.isUndefined(config.host);
          assert.isUndefined(config.port);
          assert.isDefined(config.filePattern);
        });
    });

    it('resolves', function() {
      return assert.isFulfilled(subject(mockUi, config));
    })
  });
});
