"use strict";
let dom = React.DOM;
let csp = require("./lib/csp.js");
let { go, take, put, chan, sleep, alts } = csp;
let t = require("./lib/transducers.js");
let { map, filter, seq, cat, mapcat } = t;
let util = require("./util");
let { rpc, clientEval, waitForPause, assert } = util;
let stores = require("./stores");
let instrument = require("./instrument");
let timeline = require("./timeline");

let App = React.createClass({
  getInitialState: function() {
    return { recording: false,
             startTime: 0 };
  },

  toggleRecord: function() {
    let state = { recording: !this.state.recording };

    if(this.state.recording) {
      instrument.deactivate();
    }
    else {
      instrument.activate();
      state.startTime = Date.now();
    }

    this.setState(state);
  },

  render: function() {
    // let statements = map(this.props.events, event => {
    //   switch(event.type) {
    //   case 'take':
    //     return 'proc ' + event.process + ' take (handler ' + event.handler + ')';
    //     break;
    //   case 'put':
    //     return 'proc ' + event.process + ' put (handler ' + event.handler + ')';
    //     break;
    //   case 'sleep':
    //     return 'proc ' + event.process + ' went to sleep (handler ' + event.handler + ')';
    //     break;
    //   case 'fulfillment':
    //     return 'value sent from ' + event.fromHandler + ' to ' + event.toHandler;
    //     break;
    //   case 'close':
    //     return 'closed ' + event.handler;
    //   }
    // });

    let statements = t.toArray(
      this.props.processes,
      mapcat(kv => {
        let id = kv[0];
        return map(kv[1].history, x => {
          return '[' + id + '] ' + x.type + ' ' + x.timeRange.join(' ');
        })
      })
    );

    return dom.div(
      { className: 'tool' },
      dom.div(
        { className: 'toolbar' },
        dom.button({ onClick: this.toggleRecord },
                   this.state.recording ? 'Stop Recording' : 'Record'),
        dom.button({ onClick: reload }, 'Reload')
      ),
      dom.div(
        { className: 'debug-panel' },
        statements.map(x => {
          return dom.div(null, x)
        })
      ),
      Timeline({ processes: this.props.processes,
                 startTime: this.state.startTime })
    );
  }
});

let Timeline = React.createClass({
  componentDidMount: function() {
    let render = () => {
      this.renderer.render(this.props.processes);

      if(!this.done) {
        requestAnimationFrame(render);
      }
    }

    let document = stores.GlobalStore.getDocument();
    let rect = this.getDOMNode().getBoundingClientRect();
    let canvas = document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas');
    this.getDOMNode().appendChild(canvas);
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    this.renderer = new timeline.Renderer(canvas,
                                          this.props.startTime);
    render();
  },

  componentDidUpdate: function() {
    //this.renderer.render(this.props.processes);
  },

  componentWillUnmount: function() {
    this.done = true;
  },

  render: function() {
    return dom.div({ className: 'timeline' });
  }
});

function init(window, toolbox) {
  let target = toolbox.target;
  stores.GlobalStore.setDocument(window.document);
  // target.on('will-navigate', willNavigate);

  go(function*() {
    let dbg = new Debugger();
    dbg.addDebuggee(toolbox.target.window.wrappedJSObject);
    stores.GlobalStore.setDebugger(dbg);

    let globalObj = dbg.makeGlobalObjectReference(toolbox.target.window);
    stores.GlobalStore.setGlobalObject(globalObj);

    render();
  });
}

function destroy() {
  instrument.deactivate();
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
  React.renderComponent(App({ events: events,
                              processes: stores.EventStore.getAllProcesses() }),
                        document.querySelector('body'));
}

module.exports = { init, destroy };
