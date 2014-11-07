var { go, take, takePropagate, put, chan, timeout, Failure } = csp;

function run() {
  //csp.logErrors();

  function bar() {
    var ch = chan();
    go(function*() {
      yield put(ch, Failure(new Error("bad thing")));
    });
    return ch;
  }

  var ch = chan();
  var ch2 = chan();

  go(function*() {
    var x = yield takePropagate(bar(), ch2);
    console.log('proc1 propagated!');
  });

  go(function*() {
    var x = yield takePropagate(ch2, ch);
    console.log('proc2 propagated!');
    yield put(ch, x * 2);
  });

  go(function*() {
    yield take(ch);
  });

}

document.getElementById('click').onclick = run;
