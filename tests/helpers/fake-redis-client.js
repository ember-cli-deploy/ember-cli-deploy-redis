var CoreObject = require('core-object');

module.exports = CoreObject.extend({
  init: function (options) {
    this.options = options;
  },
  get: function(key) {
    return Promise.resolve('some-other-value');
  },
  set: function() { },
  del: function() { },
  zadd: function(key, score, tag) {
  },
  zrem: function() {
  },
  zrange: function() {
  },
  zrevrange: function() {
  }
});
