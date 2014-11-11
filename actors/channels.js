let protocol = require('devtools/server/protocol');
let {method, Arg, Option, RetVal} = protocol;

exports.register = function(handle) {
  handle.addTabActor(ChannelActor, "channelActor");
}

exports.unregister = function(handle) {
  handle.removeTabActor(ChannelActor);
}

let ChannelActor = protocol.ActorClass({
  typeName: 'channelActor',
  initialize: function(conn) {
    console.log(ChannelActor, 'CREATING');
    protocol.Actor.prototype.initialize.call(this, conn);
  },

  sayHello: method(function() {
    return "hi";
  }, {
    request: {},
    response: {
      greeting: RetVal("string")
    }
  })
});

let ChannelFront = protocol.FrontClass(ChannelActor, {
  initialize: function(client, form) {
    protocol.Front.prototype.initialize.call(this, client, form);
  }
});

exports.ChannelActor = ChannelActor;
