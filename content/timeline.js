let t = require("./lib/transducers.js");
let { map, filter, seq, cat, mapcat } = t;

function lookupColor(type) {
  switch(type) {
  case 'sleep':
    return '#5f7387';
  case 'take':
  case 'put':
    return '#70bf53';
  }
  throw new Error('lookupColor: unknown type: ' + state.type);
}

function Renderer(node) {
  let rect = node.getBoundingClientRect();
  let width = rect.width;
  let height = rect.height;
  this.node = d3.select(node);
  this.width = width;
  this.height = height;
}

Renderer.prototype.setHeight = function(height) {
  //console.log(height);
  this.node.attr('height', height);
  this.height = height;
}

Renderer.prototype.render = function(processes, startTime, stopTime) {
  this.scaleX = d3.scale.linear()
    .domain([startTime, stopTime || Date.now()])
    .range([0, this.width]);

  var sel = this.node.selectAll('g.process').data(processes);
  sel.enter()
    .append('g')
    .attr('transform', function(d, i) {
      return 'translate(0, ' + ((i * 35) + 15) + ')';
    })
    .attr('class', 'process')
    .append('rect')
    .attr('x', 0).attr('y', 0)
    .attr('width', this.width).attr('height', 35)
    .attr('fill', function(d, i) {
      return i % 2 === 0 ? '#f5f5f5' : '#eaeaea';
    });
  sel.exit().remove();

  let me = this;
  sel.each(function(proc) {
    me.renderProcess(this, proc);
  });
}

Renderer.prototype.renderProcess = function(node, process) {
  node = d3.select(node);
  let offsetY = 7;

  let sel = node.selectAll('.bar').data(process.history);
  sel.enter().append('rect');
  sel.attr('x', state => {
    return this.scaleX(state.timeRange[0]);
  })
    .attr('y', offsetY)
    .attr('width', state => {
      return (this.scaleX(state.timeRange[1]) -
              this.scaleX(state.timeRange[0]));
    })
    .attr('height', 20)
    .attr('fill', state => lookupColor(state.type))
    .attr('class', 'bar');

  if(process.currentState) {
    let sel = node.selectAll('.currentBar').data([process.currentState]);
    sel.enter().append('rect');
    sel.attr('x', state => {
      return this.scaleX(state.started);
    })
      .attr('y', offsetY)
      .attr('width', state => {
        return this.width - this.scaleX(state.started);
      })
      .attr('height', 20)
      .attr('fill', state => {
        return lookupColor(state.type);
      })
      .attr('class', 'currentBar');
  }
  else {
    node.select('.currentBar').remove();
  }
}

module.exports = { Renderer };
