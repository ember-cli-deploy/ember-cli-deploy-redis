/* jshint node: true */
var Promise = require('ember-cli/lib/ext/promise');
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
    return Promise.resolve(this.recentRevisions);
  },
  mget: function() {
    return Promise.resolve();
  }
});
