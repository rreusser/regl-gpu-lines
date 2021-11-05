const regl = createREGL({
  extensions: ['ANGLE_instanced_arrays']
});

// Instantiate a command for drawing lines
const drawLines = reglLines(regl, {
  vert: `
    precision highp float;

    #pragma lines: attribute vec2 xy;

    // Assign a function for computing the vec4 position
    #pragma lines: position = getPosition(xy);

    // Assign a function for computing the float width
    #pragma lines: width = getWidth(xy);

    // Compute a varying value from the input attribute
    #pragma lines: varying float x = getX(xy);

    uniform float width;

    // Implement the functions above
    vec4 getPosition(vec2 xy) { return vec4(xy, 0, 1); }
    float getWidth(vec2 xy) { return width * (0.5 + 0.4 * cos(16.0 * xy.x)); }
    float getX(vec2 xy) { return xy.x; }`,
  frag: `
    precision lowp float;
    varying float x;
    void main () {
      gl_FragColor = vec4(0.5 + cos(8.0 * (x - vec3(0, 1, 2) * 3.141 / 3.0)), 1);
    }`,

  // Additional regl command properties are valid
  uniforms: {
    width: regl.prop('width')
  },

  depth: {enable: false}
});

// Construct an array of xy pairs
const n = 101;
const xy = [...Array(n).keys()]
  .map(i => (i / (n - 1) * 2.0 - 1.0) * 0.8)
  .map(t => [t, 0.5 * Math.sin(8.0 * t)]);

// Set up the data to be drawn. Note that we preallocate buffers and don't create
// them on every draw call.
const lineData = {
  join: 'round',
  cap: 'round',
  vertexCount: xy.length,
  vertexAttributes: {
    xy: regl.buffer(xy)
  },
  endpointCount: 2,
  endpointAttributes: {
    xy: regl.buffer([xy.slice(0, 3), xy.slice(-3).reverse()])
  },

  // Picked up by regl.prop('width')
  width: 50
};

function draw () {
  regl.poll();
  regl.clear({color: [0.2, 0.2, 0.2, 1]});
  drawLines(lineData);
}

draw();
window.addEventListener('resize', draw);
