let csp = require("./lib/csp.js");
let { go, take, put, chan, sleep } = csp;
let util = require("./util");
let { rpc, rpc1, rpc2, clientEval, waitForPause, assert } = util;
let t = require("./lib/transducers.js");
let { map, filter, seq } = t;

let GlobalStore = {
  getDebugger: function() {
    return this.dbg;
  },

  setDebugger: function(dbg) {
    this.dbg = dbg;
  },

  getGlobalObject: function() {
    return this.obj;
  },

  setGlobalObject: function(obj) {
    this.obj = obj;
  },

  getTarget: function() {
    return this.target;
  },

  setTarget: function(target) {
    this.target = target;
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
  transfers: [],
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

      if(event.processEnding) {
        setTimeout(() => {
          let cur = t.toArray(this.activeHandlers,
                            filter(kv => kv[1] === proc));
          if(cur.length) {
            cur = cur[0];
            delete this.activeHandlers[cur[0]];
            proc.currentState = null;
          }
        }, 500);
      }
    }
    else if(type === 'fulfillment') {
      let fromProc = this.activeHandlers[event.fromHandler];
      let toProc = this.activeHandlers[event.toHandler];
      let proc;

      if(fromProc && toProc) {
        proc = (fromProc.currentState.started < toProc.currentState.started ?
                fromProc :
                toProc)
      }
      else {
        proc = toProc;
      }

      proc.history.push({
        type: proc.currentState.type,
        timeRange: [proc.currentState.started, event.time]
      });
      toProc.currentState = null;
      if(fromProc) {
        fromProc.currentState = null;
      }

      if(fromProc) {
        this.transfers.push({
          fromProc: fromProc,
          toProc: toProc,
          time: event.time
        });
      }

      delete this.activeHandlers[event.fromHandler];
      delete this.activeHandlers[event.toHandler];
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

  getAllTransfers: function() {
    return this.transfers;
  },

  clear: function() {
    this.events = [];
    this.processes = [];
    this.processesById = {};
    this.transfers = [];
    this.activeHandlers = {};
  }
}

module.exports = {
  GlobalStore,
  EventStore
};
