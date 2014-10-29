var { go, take, put, chan, timeout } = csp;

function run() {
  var ch = chan();

  go(function*() {
    yield put(ch, 5);
    yield timeout(1000);
    yield put(ch, 10);
  });

  go(function*() {
    yield take(ch);
    yield take(ch);
  });
}

document.getElementById('click').onclick = run;
