let csp = require("./lib/csp.js");
let { go, take, put, chan, sleep } = csp;

let GlobalStore = {
  getThread: function() {
    return this.thread;
  },

  setThread: function(thread) {
    this.thread = thread;
  },

  getDocument: function() {
    return this.document;
  },

  setDocument: function(doc) {
    this.document = doc;
  }
};

let EventStore = {
  add: chan(),
  processes: {},

  addEvent: function(event) {
    let proc = processes[event.process];
    // add "take from time T1 to T2"
    // or "put from time T1 to T2"
    // or "slept from time T1 to T2"

    csp.putAsync(this.add, event);
  }
}

module.exports = {
  GlobalStore,
  EventStore
};
