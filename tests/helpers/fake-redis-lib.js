var FakeClient = require('./fake-redis-client');

var CoreObject = require('core-object');

module.exports = CoreObject.extend({
  init: function(clientClass) {
      this.clientClass = clientClass || FakeClient;
  },

  createClient: function(options) {
    this.options = options;
    this.createdClient = new this.clientClass(options);
    return this.createdClient;
  }
});
