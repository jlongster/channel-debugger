let t = require("./lib/transducers.js");
let { map, filter, seq, cat, mapcat } = t;

function Renderer(node, startTime) {
  let rect = node.getBoundingClientRect();
  var width = rect.width;
  var height = rect.height;

  this.node = d3.select(node);
  this.width = width;
  this.height = height;
  this.xScale = d3.scale.linear()
    .domain([startTime, Date.now()])
    .range([0, width]);
}

Renderer.prototype.render = function(processes) {
  processes = t.toArray(processes, map(kv => t.merge(kv[1], { id: kv[0] })));

  for(var i in processes) {
    var g = this.node.append('g')
        .attr('class', 'process')
        .attr('transform', 'translate(0, ' + (i * 50) + ')');
    this.renderProcess(g, processes[i]);
  }
}

Renderer.prototype.renderProcess = function(node, process) {
  node.append('rect')
    .attr('width', 100)
    .attr('height', 25)
    .attr('fill', 'red');
}

module.exports = { Renderer };
