"use strict";
let dom = React.DOM;
let div = dom.div;
let csp = require("./lib/csp.js");
let { go, take, put, chan, sleep, alts } = csp;
let t = require("./lib/transducers.js");
let { map, filter, seq, cat, mapcat } = t;
let util = require("./util");
let { rpc, rpc1, rpc2, clientEval, waitForPause, assert } = util;
let stores = require("./stores");
let instrument = require("./instrument");
let timeline = require("./timeline");
let gDevTools = require('devtools/gDevTools.jsm').gDevTools;

let App = React.createClass({
  getInitialState: function() {
    return { recording: false,
             startTime: 0,
             stopTime: null };
  },

  toggleRecord: function() {
    let state = { recording: !this.state.recording };

    if(this.state.recording) {
      instrument.deactivate();
      state.stopTime = Date.now();
    }
    else {
      instrument.activate();
      state.startTime = Date.now();
      state.stopTime = null;
    }

    this.setState(state);
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

    // let statements = t.toArray(
    //   this.props.processes,
    //   mapcat(kv => {
    //     let id = kv[0];
    //     return map(kv[1].history, x => {
    //       return '[' + id + '] ' + x.type + ' ' + x.timeRange.join(' ');
    //     })
    //   })
    // );

    return div(
      { className: 'tool' },
      div(
        { className: 'toolbar' },
        dom.button({ onClick: this.toggleRecord },
                   this.state.recording ? 'Stop Recording' : 'Record'),
        dom.button({ onClick: reload }, 'Reload')
      ),
      div(
        { className: 'debug-panel' },
        statements.map(x => {
          return div(null, x)
        })
      ),
      Timeline({
        processes: this.props.processes,
        transfers: this.props.transfers,
        startTime: this.state.startTime,
        stopTime: this.state.stopTime
      })
    );
  }
});

let Timeline = React.createClass({
  componentDidMount: function() {
    let render = () => {
      this.renderer.render(this.props.processes,
                           this.props.transfers,
                           this.props.startTime,
                           this.props.stopTime);

      if(!this.done) {
        requestAnimationFrame(render);
      }
    }

    let document = stores.GlobalStore.getDocument();
    let svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.getDOMNode().querySelector('.timeline-wrapper').appendChild(svg);
    this.renderer = new timeline.Renderer(svg);
    render();
  },

  componentDidUpdate: function() {
    let wrapper = this.getDOMNode().querySelector('.timeline-wrapper');
    let rect = wrapper.getBoundingClientRect();
    this.renderer.setHeight(rect.height);
  },

  componentWillUnmount: function() {
    this.done = true;
  },

  openProcess: function(proc) {
    let showSource = ({ DebuggerView }) => {
      let url = proc.meta.url;
      if (DebuggerView.Sources.containsValue(url)) {
        DebuggerView.setEditorLocation(url,
                                       proc.meta.line,
                                       { noDebug: true });
      }
    };

    let toolbox = gDevTools.getToolbox(stores.GlobalStore.getTarget());
    let debuggerAlreadyOpen = toolbox.getPanel("jsdebugger");
    toolbox.selectTool('jsdebugger').then(({ panelWin: dbg }) => {
      if(debuggerAlreadyOpen) {
        showSource(dbg);
      }
      else {
        dbg.once(dbg.EVENTS.SOURCES_ADDED, () => showSource(dbg));
      }
    });
  },

  render: function() {
    return div(
      { className: 'timeline' },
      div({ className: 'timeline-wrapper' },
          div({ className: 'labels' },
              this.props.processes.map(proc => {
                return dom.div(
                  null,
                  dom.a({ href: '#',
                          onClick: this.openProcess.bind(null, proc) },
                        proc.meta.name || 'anon')
                );
              })))
    );
  }
});

function init(window, toolbox) {
  let target = toolbox.target;

  let dbg = new Debugger();
  stores.GlobalStore.setDebugger(dbg);
  stores.GlobalStore.setDocument(window.document);
  stores.GlobalStore.setTarget(target);

  function _init() {
    // dbg.addDebuggee(toolbox.target.window.wrappedJSObject);
    // let globalObj = dbg.makeGlobalObjectReference(toolbox.target.window);
    // stores.GlobalStore.setGlobalObject(globalObj);
    // render();

    console.log('tab', target.activeTab.client.mainRoot);

    // go(function*() {
    //   //let thread = yield rpc1(target.activeTab, 'attachThread', {});
    // });
  }

  target.on('will-navigate', () => {
    dbg.removeAllDebuggees();
    stores.EventStore.clear();
    React.unmountComponentAtNode(window.document.querySelector('body'));
  });

  target.on('navigate', _init);
  _init();

  renderLoop();
}

function destroy() {
  instrument.deactivate();
}

function renderLoop() {
  go(function*() {
    while((yield take(stores.EventStore.add)) !== csp.CLOSED) {
      render();
    }
  });
}

function render() {
  let document = stores.GlobalStore.getDocument();
  React.renderComponent(App({ events: stores.EventStore.getAllEvents(),
                              processes: stores.EventStore.getAllProcesses(),
                              transfers: stores.EventStore.getAllTransfers() }),
                        document.querySelector('body'));
}

module.exports = { init, destroy };
