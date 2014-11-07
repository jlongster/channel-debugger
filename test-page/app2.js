var { go, take, put, chan, timeout } = csp;

function run2() {
  eval(document.getElementById('code').value);
}

function run() {
  var ch = chan();

  go(function* proc1() {
    var v;
    while((v = yield take(ch)) !== csp.CLOSED) {
      yield take(timeout(300));
      yield put(ch, 2);
    }

    console.log('done1');
  });

  go(function* proc2() {
    var v;
    yield put(ch, 1);
    while((v = yield take(ch)) !== csp.CLOSED) {
      yield take(timeout(200));
      yield put(ch, 3);
    }

    console.log('done2');
  });

  go(function*() {
    yield take(timeout(5000));
    ch.close();
  });
}

document.getElementById('click').onclick = run;
