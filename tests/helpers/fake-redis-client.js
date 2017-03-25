var RSVP = require('rsvp');
var CoreObject = require('core-object');

module.exports = CoreObject.extend({
  init: function (options) {
    this._super();
    this.recentRevisions = [];
    this.options = options;
  },
  get: function(/* key */) {
    return RSVP.resolve('some-other-value');
  },
  set: function() { },
  del: function() { },
  zadd: function(key, score , tag) {
    var prefix = key.replace(':revisions','');
    this.recentRevisions.push(prefix + ':' + tag);
  },
  zrem: function(key, revision) {
    var i = this.recentRevisions.indexOf(revision);
    this.recentRevisions.splice(i,1);
  },
  zrange: function() {
  },
  zrevrange: function() {
    return RSVP.resolve(this.recentRevisions);
  },
  mget: function() {
    return RSVP.resolve();
  }
});
