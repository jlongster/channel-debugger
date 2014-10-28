


function render(svgNode, events) {
  let rect = svgNode.getBoundingClientRect();


  console.log('rendering...', rect.width, rect.height);
}

module.exports = { render };
