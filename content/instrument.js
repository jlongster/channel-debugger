let csp = require("./lib/csp.js");
let { go, take, put, chan, sleep, alts } = csp;
let t = require("./lib/transducers.js");
let util = require("./util");
let { rpc, rpc1, rpc2, clientEval, waitForPause, assert } = util;
let stores = require("./stores");

var activeBreakpoints = {};
var chans = {
  breaks: chan()
}

function activate() {
  let dbg = stores.GlobalStore.getDebugger();
  let globalObj = stores.GlobalStore.getGlobalObject();

  // We need to get inside the "process" module, so set a breakpoint
  // inside a public function and call it so that we pause inside of
  // it
  let FnHandlerLoc;
  breakInsideFunction('csp.take', 'csp.take()', 1, function(frame) {
    let FnHandler = frame.environment.parent.getVariable('FnHandler');
    FnHandlerLoc = {
      url: FnHandler.script.source.url,
      line: FnHandler.script.startLine
    };
  });

  // Set a breakpoint in `go`
  let goFn = globalObj.evalInGlobal('csp.go').return;
  let goBp = setBreakpoint(dbg, {
    url: goFn.script.source.url,
    line: goFn.script.startLine + 2
  }, handleGo);
  activeBreakpoints.go = goBp;

  // Set a breakpoint in the `FnHandler` constructor
  let createBp = setBreakpoint(dbg, {
    url: FnHandlerLoc.url,
    line: FnHandlerLoc.line + 1
  }, handleNewHandler);
  activeBreakpoints.handlerCreate = createBp;

  // Set a breakpoint in the `FnHandler.prototype.commit` function
  let commitBp = setBreakpoint(dbg, {
    url: FnHandlerLoc.url,
    line: FnHandlerLoc.line + 9
  }, handleNewCommit);
  activeBreakpoints.handlerCommit = commitBp;

  // Set a breakpoint in the `timeout` function
  let timeoutFn = globalObj.evalInGlobal('csp.timeout').return;
  let timeoutBp = setBreakpoint(dbg, {
    url: timeoutFn.script.source.url,
    line: timeoutFn.script.startLine + 2
  }, handleTimeout);
  activeBreakpoints.timeout = timeoutBp;

  stores.EventStore.clear();
}

function deactivate() {
  let { handlerCreate, handlerCommit, timeout } = activeBreakpoints;
  if(handlerCreate) {
    removeBreakpoint(handlerCreate);
    activeBreakpoints.handlerCreate = null;
  }
  if(handlerCommit) {
    removeBreakpoint(handlerCommit);
    activeBreakpoints.handlerCommit = null;
  }
  if(timeout) {
    removeBreakpoint(timeout);
    activeBreakpoints.timeout = null;
  }
}

function setBreakpoint(dbg, loc, cb) {
  let scripts = dbg.findScripts({ url: loc.url });
  for(let script of scripts) {
    let offsets = script.getLineOffsets(loc.line);
    if(offsets.length) {
      let bp = { hit: cb,
                 script: script };
      script.setBreakpoint(offsets[0], bp);
      return bp;
    }
  }
}

function removeBreakpoint(bp) {
  bp.script.clearBreakpoint(bp);
}

function breakInsideFunction(expr, callExpr, offset = 0, cb) {
  let globalObj = stores.GlobalStore.getGlobalObject();
  var res = globalObj.evalInGlobal(expr).return;
  let script = res.script;
  let loc = {
    url: res.script.source.url,
    line: res.script.startLine + offset,
  };

  let bp = { hit: cb };
  script.setBreakpoint(script.getLineOffsets(loc.line)[0], bp);
  globalObj.evalInGlobal('csp.take()');
  script.clearBreakpoint(bp);
}

let _lastId = 0;
function newObjectId() {
  return ++_lastId;
}

// handlers

function handleGo(frame) {
  let f = frame.environment.getVariable('f');
  let gen = frame.environment.getVariable('gen');
  gen._procInfo = {
    name: f.name || f.displayName,
    url: f.script.source.url,
    line: f.script.startLine
  }
}

function handleNewHandler(frame) {
  let frame0 = frame;
  let frame1 = frame0.older;
  let frame2 = frame1.older;

  if(frame2.environment.parent.callee.name === 'spawn') {
    return;
  }

  let handler = frame0.this;
  let channel = frame1.environment.getVariable('channel');
  let proc = frame2.this;

  let handlerId = handler._id = handler._id || newObjectId();
  let channelId = channel._id = channel._id || newObjectId();
  let procId = proc._id = proc._id || newObjectId();

  let procInfo = proc.getOwnPropertyDescriptor('gen').value._procInfo;
  stores.EventStore.addProcess(procId, procInfo);

  let _timeout = channel.getOwnPropertyDescriptor('_timeout');
  let isTimeout = _timeout && _timeout.value !== undefined;

  if(isTimeout) {
    // Process X goes to sleep
    stores.EventStore.addEvent({
      type: 'sleep',
      process: procId,
      handler: handlerId,
      time: Date.now()
    });
  }
  else if(frame1.callee.name === 'take_then_callback') {
    // A `take` request from process X
    stores.EventStore.addEvent({
      type: 'take',
      process: procId,
      channel: channelId,
      handler: handlerId,
      time: Date.now()
    });
  }
  else if(frame1.callee.name === 'put_then_callback') {
    // A `put` request from process X
    stores.EventStore.addEvent({
      type: 'put',
      process: procId,
      channel: channelId,
      handler: handlerId,
      time: Date.now()
    });
  }
  else {
    throw new Error('handleNewHandler: unknown callee: ' +
                    frame1.callee);
  }
}

function handleNewCommit(frame) {
  let frame0 = frame;
  let frame1 = frame0.older;

  if(frame1.older &&
     frame1.older.older &&
     frame1.older.older.environment.parent.callee.name === 'spawn') {
    return;
  }

  let handlerId = frame0.this._id;
  let funcName = frame1.callee.displayName;
  let isPut = funcName.indexOf('_put') !== -1;
  let isTake = funcName.indexOf('_take') !== -1;
  var isClose = funcName.indexOf('close') !== -1;

  if(isPut || isTake) {
    let argHandler = frame1.environment.getVariable('handler');
    let argHandlerId = argHandler._id;

    // Ignore commits that immediately commit the argument handler.
    // Only fire events for commits from a pending take/put
    if(argHandlerId !== handlerId) {
      stores.EventStore.addEvent({
        type: 'fulfillment',
        fromHandler: isPut ? argHandlerId : handlerId,
        toHandler: isPut ? handlerId : argHandlerId,
        time: Date.now()
      });
    }
    else {
      if(frame1.this.getOwnPropertyDescriptor('closed').value === true) {
        stores.EventStore.addEvent({
          type: 'close',
          handler: handlerId,
          time: Date.now()
        });
      }
    }
  }
  else if(isClose) {
    stores.EventStore.addEvent({
      type: 'close',
      handler: handlerId,
      time: Date.now()
    });
  }
}

function handleTimeout(frame) {
  frame.eval('chan._timeout = true');
}

module.exports = { activate, deactivate };
