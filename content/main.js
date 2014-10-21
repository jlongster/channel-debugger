"use strict";
let dom = React.DOM;
let csp = require("./lib/csp.js");
let { go, take, put, chan, sleep } = csp;
let t = require("./lib/transducers.js");
let { waitCallbackM } = require("./util");

let App = React.createClass({
  getInitialState: function() {
    return { evalResult: null };
  },

  eval: function() {
    // TODO:
    // * Add an option for evaluting code in global scope in thread actor
    // * Possibly change it to properly respond with the right
    //   evaluation packet, not a resume
    // * Or maybe just treat the connection as an events and not a
    //   sequential flow of packets

    go(function*() {
      let threadClient = this.props.threadClient;
      console.log(threadClient.state);
      let [res] = yield take(waitCallbackM(threadClient,
                                           threadClient.eval,
                                           null, 'foo'));
      console.log(res.toSource());
      this.setState({ evalResult: res.toSource() });
    }.bind(this))
  },

  render: function() {
    return dom.div(
      null,
      dom.button({ onClick: this.eval }, 'eval'),
      dom.div(null, this.state.evalResult)
    );
  }
});

function init(window, toolbox) {
  let target = toolbox.target;
  let document = window.document;

  // target.on('will-navigate', willNavigate);



  go(function*() {
    let [res, threadClient] = yield take(waitCallbackM(target.activeTab,
                                                       target.activeTab.attachThread,
                                                       {}));

    React.renderComponent(App({ threadClient: threadClient }),
                          document.querySelector('body'));
  });
}

module.exports = {
  init: init
};
