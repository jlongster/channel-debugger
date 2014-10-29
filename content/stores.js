let csp = require("./lib/csp.js");
let { go, take, put, chan, sleep } = csp;

let GlobalStore = {
  getDebugger: function() {
    return this.dbg;
  },

  setDebugger: function(dbg) {
    this.dbg = dbg;
  },

  getGlobalObject: function(obj) {
    return this.obj;
  },

  setGlobalObject: function(obj) {
    this.obj = obj;
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
  events: [],
  processes: [],
  processesById: {},
  activeHandlers: {},

  addEvent: function(event) {
    let type = event.type;

    if(type === 'sleep' || type === 'take' || type === 'put') {
      let proc = this.processesById[event.process];
      if(proc) {
        proc.currentState = {
          type: type,
          started: event.time
        };
        this.activeHandlers[event.handler] = proc;
      }
    }
    else if(type === 'fulfillment') {
      let fromProc = this.activeHandlers[event.fromHandler];
      let toProc = this.activeHandlers[event.toHandler];

      if(fromProc && toProc) {
        let proc = (fromProc.currentState.started < toProc.currentState.started ?
                    fromProc :
                    toProc)

        proc.history.push({
          type: proc.currentState.type,
          timeRange: [proc.currentState.started, event.time]
        })
        toProc.currentState = null;
        fromProc.currentState = null;

        delete this.activeHandlers[event.fromHandler];
        delete this.activeHandlers[event.toHandler];
      }
    }
    else if(type === 'close') {
      let proc = this.activeHandlers[event.handler];
      if(proc) {
        proc.history.push({
          type: proc.currentState.type,
          timeRange: [proc.currentState.started, event.time]
        });
        proc.currentState = null;
      }
    }

    this.events.push(event);
    csp.putAsync(this.add, event, function() {});
  },

  addProcess: function(id, procInfo) {
    procInfo = procInfo || {
      name: '???',
      url: '???',
      line: 0
    };

    if(!this.processesById[id]) {
      let proc = this.processesById[id] = {
        id: id,
        meta: procInfo,
        history: [],
        currentState: null
      };

      this.processes.push(proc);
    }
  },

  getAllProcesses: function() {
    return this.processes;
  },

  getAllEvents: function() {
    return this.events;
  },

  clear: function() {
    this.events = [];
    this.processes = [];
    this.processesById = {};
    this.activeHandlers = {};
  }
}

module.exports = {
  GlobalStore,
  EventStore
};
