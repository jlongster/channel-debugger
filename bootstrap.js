"use strict";
const { classes: Cc, interfaces: Ci, utils: Cu, results: Cr } = Components;

let loader = Cu.import("resource://gre/modules/commonjs/toolkit/loader.js", {}).Loader;
let require = loader.Require(
  new loader.Loader({
    paths: { "": "resource://gre/modules/commonjs/",
             "devtools": "resource:///modules/devtools",
             "modules": "resource://csp-debugger" }
  }),
  { id: 'csp-debugger' }
);

let gDevTools = require('devtools/gDevTools.jsm').gDevTools;
let util = require('sdk/lang/functional');

let makeToolDefinition = util.once(() => {
  return {
    id: 'csp-debugger',
    ordinal: 99,
    url: "chrome://csp-debugger/content/main.xul",
    label: 'CSP Debugger',
    tooltip: 'Debug CSP channels',
    isTargetSupported: function(target) {
      return true;
    },
    build: function(iframeWindow, toolbox) {
      //let app = require("modules/main.js");
      // Cu.import("resource://csp-debugger/main.js");

      return {
        open: function() {
          // app.init(iframeWindow, toolbox);
          return this;
        },
        destroy: function() {
        },
      };
    }
  }
});

function startup() {
  gDevTools.registerTool(makeToolDefinition());
}

function shutdown() {
  gDevTools.unregisterTool(makeToolDefinition());
}
