"use strict";
const { classes: Cc, interfaces: Ci, utils: Cu, results: Cr } = Components;

// var globalMM = Cc["@mozilla.org/globalmessagemanager;1"]
//     .getService(Ci.nsIMessageListenerManager);

// globalMM.loadFrameScript('chrome://csp-debugger/content/frame.js', false);

const { devtools } = Cu.import("resource://gre/modules/devtools/Loader.jsm", {});
const loader = devtools;
const require = loader.require;

const Debugger = require('Debugger');
const util = require('sdk/lang/functional');
const gDevTools = require('devtools/gDevTools.jsm').gDevTools;

const makeToolDefinition = util.once(() => {
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
      let instance = loader.provider.loader;
      instance.globals.setTimeout = loader.require('sdk/timers').setTimeout;
      instance.globals.React = iframeWindow.React;
      instance.globals.d3 = iframeWindow.d3;
      instance.globals.requestAnimationFrame = iframeWindow.mozRequestAnimationFrame;
      instance.globals.Debugger = Debugger;

      instance.globals.reload = function() {
        let def = makeToolDefinition();
        gDevTools.unregisterTool(def);
        gDevTools.registerTool(def);
        toolbox.selectTool(def.id);
      };

      //const path = "chrome://csp-debugger/content";
      const path = "file:///Users/james/projects/mozilla/channel-debugger/content/main.js";
      let app = require(path);

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
