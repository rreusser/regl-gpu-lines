const regl = createREGL({
  extensions: ['ANGLE_instanced_arrays']
});

// Instantiate a command for drawing lines
const drawLines = createDrawLines(regl, {
  vert: `
    precision highp float;

    #pragma lines: attribute vec2 xy;

    // Assign a function for computing the vec4 position
    #pragma lines: position = getPosition(xy);

    // Assign a function for computing the float width
    #pragma lines: width = getWidth(xy);

    uniform float width;

    // Implement the functions above
    vec4 getPosition(vec2 xy) { return vec4(xy, 0, 1); }
    float getWidth(vec2 xy) { return width; }
    float getX(vec2 xy) { return xy.x; }`,
  frag: `
    precision highp float;
    varying vec2 lineCoord;
    uniform float width, borderWidth;
    void main () {
      // Convert the line coord into an SDF
      float sdf = length(lineCoord) * width;

      // Use the y-value of the line coord to distinguish between sides of the line
      vec3 borderColor = lineCoord.y < 0.0 ? vec3(1, 0.5, 0.5) : vec3(0.5, 0.5, 1);

      // Apply a border with 1px transition
      gl_FragColor = vec4(
        mix(vec3(0), borderColor, smoothstep(width - borderWidth - 0.5, width - borderWidth + 0.5, sdf)),
        1);
    }`,

  // Additional regl command properties are valid
  uniforms: {
    width: (ctx, props) => ctx.pixelRatio * props.width,
    borderWidth: (ctx, props) => ctx.pixelRatio * props.borderWidth,
  },
});

// Construct an array of xy pairs
const n = 21;
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

  width: 25,
  borderWidth: 10
};

function draw () {
  regl.poll();
  regl.clear({color: [0.2, 0.2, 0.2, 1]});
  drawLines(lineData);
}

draw();
window.addEventListener('resize', draw);
