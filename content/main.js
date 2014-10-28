"use strict";
let dom = React.DOM;
let csp = require("./lib/csp.js");
let { go, take, put, chan, sleep, alts } = csp;
let t = require("./lib/transducers.js");
let { map, filter, seq } = t;
let util = require("./util");
let { rpc, clientEval, waitForPause, assert } = util;
let stores = require("./stores");
let instrument = require("./instrument");
let timeline = require("./timeline");

let App = React.createClass({
  getInitialState: function() {
    return { recording: false };
  },

  toggleRecord: function() {
    if(this.state.recording) {
      instrument.deactivate(this.props.threadClient);
    }
    else {
      instrument.activate(this.props.threadClient);
    }

    this.setState({ recording: !this.state.recording });
  },

  render: function() {
    let statements = map(this.props.events, event => {
      switch(event.type) {
      case 'take':
        return 'proc ' + event.process + ' take (handler ' + event.handler + ')';
        break;
      case 'put':
        return 'proc ' + event.process + ' put (handler ' + event.handler + ')';
        break;
      case 'sleep':
        return 'proc ' + event.process + ' went to sleep (handler ' + event.handler + ')';
        break;
      case 'fulfillment':
        return 'value sent from ' + event.fromHandler + ' to ' + event.toHandler;
        break;
      case 'close':
        return 'closed ' + event.handler;
      }
    });

    return dom.div(
      { className: 'tool' },
      dom.div(
        { className: 'toolbar' },
        dom.button({ onClick: this.toggleRecord },
                   this.state.recording ? 'Stop Recording' : 'Record')
      ),
      dom.div(
        { className: 'debug-panel' },
        statements.map(x => {
          return dom.div(null, x)
        })
      ),
      Timeline({ events: this.props.events })
    );
  }
});

let Timeline = React.createClass({
  componentDidMount: function() {
    let render = () => {
      timeline.render(this.getDOMNode(), this.props.events);

      if(!this.done) {
        requestAnimationFrame(render);
      }
    }

    render();
  },

  componentWillUnmount: function() {
    this.done = true;
  },

  render: function() {
    return dom.div({ className: 'timeline' }, dom.svg(null));
  }
});

function init(window, toolbox) {
  let target = toolbox.target;
  stores.GlobalStore.setDocument(window.document);
  // target.on('will-navigate', willNavigate);

  go(function*() {
    let [, threadClient] = yield rpc(target.activeTab, 'attachThread', {});
    stores.GlobalStore.setThread(threadClient);
    render();

    if(threadClient.paused) {
      yield rpc(threadClient, 'resume');
    }
  });
}

function render() {
  go(function*() {
    var events = [];
    let event;

    _render(events);

    while((event = yield take(stores.EventStore.add)) !== csp.CLOSED) {
      events.push(event);
      _render(events);
    }
  });
}

function _render(events) {
  let document = stores.GlobalStore.getDocument();
  React.renderComponent(App({ threadClient: stores.GlobalStore.getThread(),
                              events: events }),
                        document.querySelector('body'));
}

module.exports = {
  init: init
};
