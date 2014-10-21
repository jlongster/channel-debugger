"use strict";
let React = require('react.js');
let dom = React.DOM;

let App = React.createClass({
  render: function() {
    return React.DOM.div(null, 'hi');
  }
});

function init(window, toolbox) {
  let target = toolbox.target;

  // target.on('will-navigate', willNavigate);

  // target.activeTab.attachThread({}, (res, threadClient) => {
  //   if(!threadClient) { return; }

  //   // yeah
  // });

  React.renderComponent(App(), document.querySelector('body'));
}
