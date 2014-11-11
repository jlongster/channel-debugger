let t = require("./lib/transducers.js");
let { map, filter, seq, cat, mapcat } = t;

function lookupColor(type) {
  switch(type) {
  case 'sleep':
    return '#aaaaaa';
  case 'take':
  case 'put':
    return '#2cbb0f';
  case 'arrow':
    return '#f13c00'
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
  this.offsetX = 25;

  this.addDefs();
  this.node.append('g').attr('class', 'axis');
  this.node.append('g').attr('class', 'processes');
  this.node.append('g').attr('class', 'transfers')
    .attr('transform', 'translate(0, 10)');
}

Renderer.prototype.addDefs = function() {
  let arrow = (id, orient, color) => {
    this.node.append("svg:defs").selectAll("#" + id)
      .data([id])
      .enter().append("svg:marker")
      .attr("id", String)
      .attr("viewBox", "0 0 6 6")
      .attr("refX", 3)
      .attr("refY", 3)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", orient)
      .attr("fill", color)
      .append("svg:path")
      .attr("d", "M0,0L6,3L0,6");
  }

  arrow('arrow-down', '90', lookupColor('arrow'));
  arrow('arrow-up', '-90', lookupColor('arrow'));
  // arrow('arrow-down-highlight', '90', '#F58321');
  // arrow('arrow-up-highlight', '-90', '#F58321');
};

Renderer.prototype.setHeight = function(height) {
  this.node.attr('height', height);
  this.height = height;
}

Renderer.prototype.render = function(processes, transfers, startTime, stopTime) {
  this.scaleX = d3.scale.linear()
    .domain([startTime || Date.now(), stopTime || Date.now()])
    .range([0, this.width]);

  let g = this.node.select('g.processes');
  let sel = g.selectAll('g.process').data(processes);
  sel.enter()
    .append('g')
    .attr('transform', (d, i) => {
      return 'translate(0, ' + ((i * 35) + this.offsetX) + ')';
    })
    .attr('class', 'process')
    .append('rect')
    .attr('class', 'row')
    .attr('x', 0)
    .attr('y', 0)
    .attr('width', this.width).attr('height', 35)
    .attr('fill', function(d, i) {
      return i % 2 === 0 ? '#f5f5f5' : '#eaeaea';
    });

  sel.exit().remove();

  let me = this;
  sel.each(function(proc) {
    me.renderProcess(this, proc);
  });

  let transferGroup = this.node.select('g.transfers');
  this.renderTransfers(transferGroup,
                       transfers,
                       processes);

  this.renderAxis(this.node.select('g.axis'), startTime);
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

Renderer.prototype.renderTransfers = function(node, transfers, processes) {
  let centerOffsetY = 32;

  transfers = map(transfers, transfer => {
    let toIdx = processes.indexOf(transfer.toProc);
    let fromIdx = transfer.fromProc ? processes.indexOf(transfer.fromProc) : toIdx;
    let fromY, toY, marker;

    if(fromIdx < toIdx) {
      fromY = fromIdx * 35 + 10 + centerOffsetY;
      toY = toIdx * 35 - 15 + centerOffsetY;
      marker = 'url("#arrow-down")';
    }
    else if(fromIdx > toIdx) {
      fromY = fromIdx * 35 - 10 + centerOffsetY;
      toY = toIdx * 35 + 15 + centerOffsetY;
      marker = 'url("#arrow-up")';
    }
    else {
      toY = (toIdx - 1) * 35 + 25 + centerOffsetY;
      fromY = toY;
      marker = 'url("#arrow-down")';
    }

    return t.merge(transfer, {
      fromY: fromY,
      toY: toY,
      marker: marker
    });
  });

  let sel = node.selectAll('.transfer').data(transfers);
  sel.enter().append('line');
  sel.attr('x1', x => this.scaleX(x.time))
    .attr('y1', x => x.fromY)
    .attr('x2', x => this.scaleX(x.time))
    .attr('y2', x => x.toY)
    .attr('stroke', lookupColor('arrow'))
    .attr('marker-end', x => x.marker)
    .attr('class', 'transfer');
  sel.exit().remove();
};

Renderer.prototype.renderAxis = function(node, startTime) {
  var axis = d3.svg.axis()
      .scale(this.scaleX)
      .ticks(5)
      .tickSize(3, 0)
      .tickFormat(d => {
        let time = d - startTime;
        if(time < 1000) {
          return '.' + time + 's';
        }
        return (time / 1000 | 0) + 's';
      })
      .orient('bottom');
  node.call(axis);
};

module.exports = { Renderer };
