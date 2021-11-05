const regl = createREGL({
  extensions: ['ANGLE_instanced_arrays']
});

// Instantiate a command for drawing lines
const drawLines = reglLines(regl, {
  vert: `
    precision highp float;

    // Use a vec2 attribute to construt the vec4 vertex position
    #pragma lines: attribute vec2 xy;
    #pragma lines: position = getPosition(xy);
    vec4 getPosition(vec2 xy) {
      return vec4(xy, 0, 1);
    }

    // Return the line width from a uniorm
    #pragma lines: width = getWidth();
    uniform float width;
    float getWidth() {
      return width;
    }`,
  frag: `
    precision lowp float;
    void main () {
      gl_FragColor = vec4(1);
    }`,

  // Multiply the width by the pixel ratio for consistent width
  uniforms: {
    width: (ctx, props) => ctx.pixelRatio * props.width
  },
});

// Construct an array of xy pairs
const n = 11;
const xy = [...Array(n).keys()]
  .map(i => (i / (n - 1) * 2.0 - 1.0) * 0.8)
  .map(t => [t, 0.5 * Math.sin(8.0 * t)]);

// Set up the data to be drawn. Note that we preallocate buffers and don't create
// them on every draw call.
const lineData = {
  width: 30,
  join: 'round',
  cap: 'round',
  vertexCount: xy.length,
  vertexAttributes: { xy: regl.buffer(xy) },
  endpointCount: 2,
  endpointAttributes: { xy: regl.buffer([xy.slice(0, 3), xy.slice(-3).reverse()]) }
};

function draw () {
  regl.poll();
  regl.clear({color: [0.2, 0.2, 0.2, 1]});
  drawLines(lineData);
}

draw();
window.addEventListener('resize', draw);
