var CoreObject = require('core-object');

module.exports = CoreObject.extend({
  init: function (options) {
    this.recentRevisions = [];
    this.options = options;
  },
  get: function(key) {
    return Promise.resolve('some-other-value');
  },
  set: function() { },
  del: function() { },
  zadd: function(key, score , tag) {
    this.recentRevisions.push(key + ':' + tag);
  },
  zrem: function(val,revision) {
    var i = this.recentRevisions.indexOf(revision)
    this.recentRevisions.splice(i,1);
  },
  zrange: function() {
  },
  zrevrange: function() {
    return this.recentRevisions;
  }
});
