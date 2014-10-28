let csp = require("./lib/csp.js");
let { go, take, put, chan, sleep } = csp;
let t = require("./lib/transducers.js");
let { seq, map } = t;

function rpc1(/* args... */) {
  return csp.operations.pipe(rpc.apply(null, arguments),
                             chan(1, map(x => x[0])));
}

function rpc2(/* args... */) {
  return csp.operations.pipe(rpc.apply(null, arguments),
                             chan(1, map(x => x[1])));
}

function rpc(ctx, methodName /*, args... */) {
  var args = seq(arguments, t.drop(2));
  var ch = chan();
  args.push(function(res) {
    if(res.error) {
      ch.error(res);
    }
    else {
      csp.putAsync(ch, seq(arguments), function() {});
    }
  });
  ctx[methodName].apply(ctx, args);
  return ch;
}

function waitForPause(threadClient) {
  let ch = chan();
  threadClient.addOneTimeListener('paused', function(evt, packet) {
    csp.putAsync(ch, packet, function(){});
  });
  return ch;
};

function clientEval(threadClient, expr, frame) {
  rpc(threadClient, 'eval', frame || null, expr);
}

function assert(cond, msg) {
  if(!cond) {
    throw new Error(msg);
  }
}

module.exports = {
  rpc, rpc1, rpc2, clientEval, waitForPause, assert
}
