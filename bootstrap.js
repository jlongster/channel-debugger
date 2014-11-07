"use strict";
const { classes: Cc, interfaces: Ci, utils: Cu, results: Cr } = Components;

let loader = Cu.import("resource://gre/modules/commonjs/toolkit/loader.js", {}).Loader;
Components.utils.import('resource://gre/modules/jsdebugger.jsm');
addDebuggerToGlobal(this);

Cu.import("resource://gre/modules/devtools/dbg-server.jsm");

function makeLoader() {
  var ContentLoader = new loader.Loader({
    paths: { "": "resource://gre/modules/commonjs/",
             "devtools": "resource:///modules/devtools",
             "devtools/server": "resource://gre/modules/devtools/server",
             //"content": "chrome://csp-debugger/content"
             "content": "file:///Users/james/projects/mozilla/channel-debugger/content" }
  });

  return {
    instance: ContentLoader,
    require: loader.Require(ContentLoader, { id: 'csp-debugger' })
  };
}

let require = makeLoader().require;
let gDevTools = require('devtools/gDevTools.jsm').gDevTools;
let util = require('sdk/lang/functional');

let makeToolDefinition = util.once(() => {
  return {
    id: 'csp-debugger',
    ordinal: 99,
    url: "chrome://csp-debugger/content/main.xul",
    label: 'Processes',
    tooltip: 'Debug Concurrent Processes',
    isTargetSupported: function(target) {
      return true;
    },
    build: function(iframeWindow, toolbox) {
      let loader = makeLoader();
      loader.instance.globals.setTimeout = loader.require('sdk/timers').setTimeout;
      loader.instance.globals.React = iframeWindow.React;
      loader.instance.globals.d3 = iframeWindow.d3;
      loader.instance.globals.requestAnimationFrame = iframeWindow.mozRequestAnimationFrame;
      loader.instance.globals.Debugger = Debugger;
      loader.instance.globals.DebuggerServer = DebuggerServer;

      loader.instance.globals.reload = function() {
        let def = makeToolDefinition();
        gDevTools.unregisterTool(def);
        gDevTools.registerTool(def);
        toolbox.selectTool(def.id);
      };

      let app = loader.require("content/main.js");

      return {
        open: function() {
          app.init(iframeWindow, toolbox);
          return this;
        },
        destroy: function() {
          app.destroy();
          var observerService = Cc["@mozilla.org/observer-service;1"]
              .getService(Components.interfaces.nsIObserverService);
          observerService.notifyObservers(null, "startupcache-invalidate", null);
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
