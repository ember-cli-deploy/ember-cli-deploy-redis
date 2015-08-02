var CoreObject = require('core-object');

module.exports = CoreObject.extend({
  init: function (options) {
    this.options = options;
  },
  get: function(key) {
    return Promise.resolve('some-other-value');
  },
  set: function() { },
  lpush: function() { },
  ltrim: function() { }
});
