var { go, take, put, chan, timeout } = csp;

function run() {
  var ch = chan();

  go(function*() {
    var v;
    while((v = yield take(ch)) !== csp.CLOSED) {
      yield take(timeout(300));
      yield put(ch, 2);
    }

    console.log('done1');
  });

  go(function*() {
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
