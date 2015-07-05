var assert = require('ember-cli/tests/helpers/assert');

describe('validate-config', function() {
  var subject;
  var config;
  var mockUi;
  var projectName = 'my-project';

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
      return assert.isFulfilled(subject(mockUi, config, projectName))
        .then(function() {
          var messages = mockUi.messages.reduce(function(previous, current) {
            if (/- Missing config:\s.*, using default:\s/.test(current)) {
              previous.push(current);
            }

            return previous;
          }, []);
          assert.equal(messages.length, 5);
        });
    });

    it('adds default config to the config object', function() {
      return assert.isFulfilled(subject(mockUi, config, projectName))
        .then(function() {
          assert.isDefined(config.host);
          assert.isDefined(config.port);
          assert.isDefined(config.keyPrefix);
          assert.isDefined(config.didDeployMessage);
        });
    });

    it('resolves', function() {
      return assert.isFulfilled(subject(mockUi, config, projectName));
    })
  });

  describe('with a keyPrefix provided', function () {
    beforeEach(function() {
      config = {
        keyPrefix: 'proj:home'
      };
    });
    it('only warns about missing optional filePattern and connection info', function() {
      return assert.isFulfilled(subject(mockUi, config, projectName))
        .then(function() {
          var messages = mockUi.messages.reduce(function(previous, current) {
            if (/- Missing config:\s.*, using default:\s/.test(current)) {
              previous.push(current);
            }

            return previous;
          }, []);

          assert.equal(messages.length, 4);
        });
    });
    it('does not add default config to the config object', function() {
      return assert.isFulfilled(subject(mockUi, config, projectName))
        .then(function() {
          assert.isDefined(config.host);
          assert.isDefined(config.port);
          assert.isDefined(config.filePattern);
          assert.isDefined(config.didDeployMessage);
          assert.equal(config.keyPrefix, 'proj:home');
        });
    });
  });

  describe('with a url provided', function () {
    beforeEach(function() {
      config = {
        url: 'redis://localhost:6379'
      };
    });
    it('warns about missing optional filePattern, keyPrefix and didDeployMessage only', function() {
      return assert.isFulfilled(subject(mockUi, config, projectName))
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

    it('does not add default config to the config object', function() {
      return assert.isFulfilled(subject(mockUi, config, projectName))
        .then(function() {
          assert.isUndefined(config.host);
          assert.isUndefined(config.port);
          assert.isDefined(config.filePattern);
          assert.isDefined(config.didDeployMessage);
        });
    });

    it('resolves', function() {
      return assert.isFulfilled(subject(mockUi, config, projectName));
    })
  });
});
