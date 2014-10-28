let csp = require("./lib/csp.js");
let { go, take, put, chan, sleep, alts } = csp;
let t = require("./lib/transducers.js");
let util = require("./util");
let { rpc, rpc1, rpc2, clientEval, waitForPause, assert } = util;
let stores = require("./stores");

var activeBreakpoints = {};

function activate() {
  let threadClient = stores.GlobalStore.getThread();

  return go(function*() {
    if(!threadClient.paused) {
      yield rpc(threadClient, 'interrupt');
    }

    // We need to get inside the "process" module, so set a breakpoint
    // inside a public function and call it so that we pause inside of
    // it
    let bpClient = yield setBreakpointWithin(threadClient, 'csp.take', 1);
    clientEval(threadClient, 'csp.take()');
    let packet = yield waitForPause(threadClient);
    assert(packet.why.type === 'breakpoint', 'Breakpoint not hit');

    let bindings = packet.frame.environment.parent.bindings;
    let FnHandler = threadClient.pauseGrip(bindings.variables.FnHandler.value);
    let FnHandlerLoc = (yield rpc(FnHandler, 'getDefinitionSite'))[0];

    // Set a breakpoint in the `FnHandler` constructor
    let createBp = yield rpc2(threadClient, 'setBreakpoint', {
      url: FnHandlerLoc.url,
      line: FnHandlerLoc.line + 1
    });
    activeBreakpoints.handlerCreate = createBp;

    // Set a breakpoint in the `FnHandler.prototype.commit` function
    let commitBp = yield rpc2(threadClient, 'setBreakpoint', {
      url: FnHandlerLoc.url,
      line: FnHandlerLoc.line + 10
    });
    activeBreakpoints.handlerCommit = commitBp;

    // Set a breakpoint in the `timeout` function
    clientEval(threadClient, 'csp.timeout');
    packet = yield waitForPause(threadClient);
    let timeoutFn = threadClient.pauseGrip(packet.why.frameFinished.return);
    let timeoutLoc = (yield rpc(timeoutFn, 'getDefinitionSite'))[0];
    let timeoutBp = yield rpc2(threadClient, 'setBreakpoint', {
      url: timeoutLoc.url,
      line: timeoutLoc.line + 2
    });
    activeBreakpoints.timeout = timeoutBp;

    // Resume from the breakpoint
    yield rpc(threadClient, 'resume');
    // Remove the breakpoint we used to get inside the process module
    yield rpc(bpClient, 'remove');

    // Resume from the original clientEval
    yield rpc(threadClient, 'resume');

    console.log('clearing');
    stores.EventStore.clear();
    threadClient.addListener('paused', onPaused);
  });
}

function deactivate() {
  let threadClient = stores.GlobalStore.getThread();
  return go(function*() {
    let { handlerCreate, handlerCommit, timeout } = activeBreakpoints;
    threadClient.removeListener('paused', onPaused);
    if(handlerCreate) {
      yield rpc(handlerCreate, 'remove');
      activeBreakpoints.handlerCreate = null;
    }
    if(handlerCommit) {
      yield rpc(handlerCommit, 'remove');
      activeBreakpoints.handlerCommit = null;
    }
    if(timeout) {
      yield rpc(timeout, 'remove');
      activeBreakpoints.timeout = null;
    }
  });
}

function onPaused(evt, packet) {
  let threadClient = stores.GlobalStore.getThread();
  let { handlerCreate, handlerCommit, timeout } = activeBreakpoints;

  if(packet.why.type === 'breakpoint') {
    let bpActor = packet.why.actors[0];

    if(handlerCreate && handlerCreate.actor === bpActor) {
      return handleNewHandler(threadClient);
    }
    else if(handlerCommit && handlerCommit.actor === bpActor) {
      return handleNewCommit(threadClient);
    }
    else if(timeout && timeout.actor === bpActor) {
      return handleTimeout(threadClient, packet.frame.actor);
    }
  }
}

function setBreakpointWithin(threadClient, expr, offset=0) {
  return go(function*() {
    clientEval(threadClient, expr);
    let res = yield waitForPause(threadClient);
    let objClient = threadClient.pauseGrip(res.why.frameFinished.return);
    let siteLoc = (yield rpc(objClient, 'getDefinitionSite'))[0];
    let loc = {
      url: siteLoc.url,
      line: siteLoc.line + offset,
      column: siteLoc.column
    };

    let [, bpClient] = yield rpc(threadClient, 'setBreakpoint', loc);
    return bpClient;
  });
}

// handlers

// process X requested a take from channel Y at time T (handler H)
// process X requested a put to channel Y at time T (handler H)
// process X requested a select from channels Yn at time T (handler H)
// channel Y resolved handlers TakeH and PutH with value V

var __lastDebuggerId = 0;
function markObject(threadClient, obj, frameActor) {
  return go(function*() {
    __lastDebuggerId++;
    clientEval(
      threadClient,
      'if(!' + obj + '.__debuggerId) {' +
        '  ' + obj + '.__debuggerId = ' + __lastDebuggerId +
        '} ' + obj + '.__debuggerId',
      frameActor
    );
    let id = (yield waitForPause(threadClient)).why.frameFinished.return;
    if(id !== __lastDebuggerId) {
      // This isn't necessary, but don't waste an id if the object
      // already had one, just for thoroughness
      __lastDebuggerId--;
    }
    return id;
  });
}

function getObjectId(threadClient, obj, frameActor) {
  return go(function*() {
    clientEval(threadClient, obj + '.__debuggerId', frameActor);
    let id = (yield waitForPause(threadClient)).why.frameFinished.return;
    return id;
  });
}

function handleNewHandler(threadClient) {
  go(function*() {
    let frames = (yield rpc(threadClient, 'getFrames', 0, 3))[0].frames;

    if(frames[2].environment.parent.function.name === 'spawn') {
      threadClient.resume();
      return;
    }

    let handlerId = yield markObject(threadClient, 'this', frames[0].actor);
    let procId = yield markObject(threadClient, 'this', frames[2].actor);
    let channelId = yield markObject(threadClient, 'channel', frames[1].actor);

    clientEval(threadClient, 'channel._timeout', frames[1].actor);
    let isTimeout = (yield waitForPause(threadClient)).why.frameFinished.return === true;

    if(isTimeout) {
      // Process X goes to sleep
      stores.EventStore.addEvent({
        type: 'sleep',
        process: procId,
        handler: handlerId,
        time: Date.now()
      });
    }
    else if(frames[1].callee.name === 'take_then_callback') {
      // A `take` request from process X
      stores.EventStore.addEvent({
        type: 'take',
        process: procId,
        channel: channelId,
        handler: handlerId,
        time: Date.now()
      });
    }
    else if(frames[1].callee.name === 'put_then_callback') {
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
                      frames[1].callee);
    }

    threadClient.resume();
  });
}

function handleNewCommit(threadClient) {
  go(function*() {
    let frames = (yield rpc(threadClient, 'getFrames', 0, 5))[0].frames;

    if(frames.length >= 4 &&
       frames[3].environment.parent.function.name === 'spawn') {
      threadClient.resume();
      return;
    }

    let handlerId = yield getObjectId(threadClient, 'this', frames[0].actor);
    let funcName = frames[1].callee.displayName;
    let isPut = funcName.indexOf('_put') !== -1;
    let isTake = funcName.indexOf('_take') !== -1;
    var isClose = funcName.indexOf('close') !== -1;

    if(isPut || isTake) {
      let argHandlerId = yield getObjectId(threadClient, 'handler', frames[1].actor);
      // Ignore commits that immediately commit the argument handler.
      // Only fire events for commits from a pending take/put
      if(argHandlerId !== handlerId) {
        yield stores.EventStore.addEvent({
          type: 'fulfillment',
          fromHandler: isPut ? argHandlerId : handlerId,
          toHandler: isPut ? handlerId : argHandlerId,
          time: Date.now()
        });
      }
    }
    else if(isClose) {
      yield stores.EventStore.addEvent({
        type: 'close',
        handler: handlerId,
        time: Date.now()
      });
    }

    threadClient.resume();
  });
}

function handleTimeout(threadClient, frameActor) {
  go(function*() {
    let frames = (yield rpc(threadClient, 'getFrames', 0, 100))[0].frames;
    clientEval(threadClient, 'chan._timeout = true', frameActor);
    yield waitForPause(threadClient);
    threadClient.resume();
  });
}

module.exports = { activate, deactivate };
