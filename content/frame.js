const { classes: Cc, interfaces: Ci, utils: Cu, results: Cr } = Components;

dump('foobarload\n');
const { DebuggerServer } = Cu.import("resource://gre/modules/devtools/dbg-server.jsm");
DebuggerServer.registerModule('file:///Users/james/projects/mozilla/channel-debugger/actors/channels.js', {
  prefix: 'channels',
  constructor: 'ChannelActor',
  type: { global: true, tab: true }
});
