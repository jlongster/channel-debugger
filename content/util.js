let csp = require("./lib/csp.js");
let { go, take, put, chan, sleep } = csp;
let t = require("./lib/transducers.js");
let { seq } = t;

function waitCallback(func /*, args... */) {
  var args = seq(arguments, t.drop(2));
  args.unshift(null);
  return waitCallbackM.apply(this, args);
}

function waitCallbackM(ctx, func /*, args... */) {
  var args = seq(arguments, t.drop(2));
  var c = chan();
  args.push(function() {
    csp.putAsync(c, seq(arguments), function() {});
  });
  func.apply(ctx, args);
  return c;
}

module.exports = {
  waitCallback: waitCallback,
  waitCallbackM: waitCallbackM
}
