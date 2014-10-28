var { go, take, put, chan } = csp;

function run() {
  var ch = chan()

  go(function*() {
    yield put(ch, 10);
    yield csp.timeout(1000);
    ch.close();
  });

  go(function*() {
    yield take(ch);
    yield take(ch);
  });
}

document.getElementById('click').onclick = run;
