let t = require("./lib/transducers.js");
let { map, filter, seq, cat, mapcat } = t;

function lookupColor(type) {
  switch(type) {
  case 'sleep':
    return '#cccccc';
  case 'take':
  case 'put':
    return 'red';
  }
  throw new Error('lookupColor: unknown type: ' + state.type);
}

function Renderer(canvas, startTime) {
  let width = canvas.width;
  let height = canvas.height;
  let ctx = canvas.getContext('2d');

  this.ctx = ctx;
  this.width = width;
  this.height = height;
}

Renderer.prototype.screenX = function(time) {
  var diff = Date.now() - time;
  // Viewport shows 30 seconds worth of events
  return Math.round(this.width - diff / 30000 * this.width);
};

Renderer.prototype.render = function(processes) {
  processes = t.toArray(processes, map(kv => t.merge(kv[1], { id: kv[0] })));

  this.ctx.fillStyle = 'white';
  this.ctx.fillRect(0, 0, this.width, this.height);

  for(let i in processes) {
    this.renderProcess(processes[i], i * 35);
  }
}

Renderer.prototype.renderProcess = function(process, startY) {
  for(let state of process.history) {
    this.ctx.fillStyle = lookupColor(state.type);
    let startX = this.screenX(state.timeRange[0])
    this.ctx.fillRect(
      startX,
      startY,
      this.screenX(state.timeRange[1]) - startX,
      10
    );
  }

  if(process.currentState) {
    let startX = this.screenX(process.currentState.started);
    this.ctx.fillStyle = lookupColor(process.currentState.type);
    this.ctx.fillRect(
      startX,
      startY,
      this.width - startX,
      10
    );
  }
}

module.exports = { Renderer };
