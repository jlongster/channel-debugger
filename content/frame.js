const { classes: Cc, interfaces: Ci, utils: Cu, results: Cr } = Components;

const { DebuggerServer } = Cu.import("resource://gre/modules/devtools/dbg-server.jsm");
const channelModule = 'file:///Users/james/projects/mozilla/channel-debugger/actors/channels.js';

if(!DebuggerServer.isModuleRegistered(channelModule)) {
  DebuggerServer.registerModule(channelModule, {
    prefix: 'channels',
    constructor: 'ChannelActor',
    type: { global: true, tab: true }
  });
}
