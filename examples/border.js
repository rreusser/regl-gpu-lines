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

    uniform float width;
    uniform vec2 translate, scale;

    // Implement the functions above
    vec4 getPosition(vec2 xy) { return vec4(xy * scale + translate, 0, 1); }
    float getWidth(vec2 xy) { return width; }
    float getX(vec2 xy) { return xy.x; }`,
  frag: `
    precision highp float;
    varying vec3 lineCoord;
    uniform float width, borderWidth;
    void main () {
      // Convert the line coord into an SDF
      float sdf = length(lineCoord.xy) * width;

      vec3 borderColor = 0.5 + 0.5 * vec3(lineCoord.xy, 0);

      // Apply a border with 1px transition
      gl_FragColor = vec4(
        mix(vec3(0), borderColor, smoothstep(width - borderWidth - 1.0, width - borderWidth + 1.0, sdf)),
        1);
    }`,

  // Additional regl command properties are valid
  uniforms: {
    width: (ctx, props) => ctx.pixelRatio * props.width,
    borderWidth: (ctx, props) => ctx.pixelRatio * props.borderWidth,
    translate: regl.prop('translate'),
    scale: regl.prop('scale')
  },
  depth: {enable: false}
});

// Construct an array of xy pairs
const n = 11;
const xy = [...Array(n).keys()]
  .map(i => (i / (n - 1) * 2.0 - 1.0) * 0.8)
  .map(t => [t, 0.5 * Math.sin(54.0 * t)]);

// Set up the data to be drawn. Note that we preallocate buffers and don't create
// them on every draw call.
const lineData = {
  vertexCount: xy.length,
  vertexAttributes: {
    xy: regl.buffer(xy)
  },
  endpointCount: 2,
  endpointAttributes: {
    xy: regl.buffer([xy.slice(0, 3), xy.slice(-3).reverse()])
  },

  width: 35,
  borderWidth: 10,
  miterLimit: 3.0,
  scale: [1, 1]
};

window.addEventListener('mousemove', e => {
  lineData.scale = [
    e.offsetX / window.innerWidth * 2 - 1,
    -e.offsetY / window.innerHeight * 2 + 1
  ];
  draw();
});


function draw () {
  regl.poll();
  regl.clear({color: [0.2, 0.2, 0.2, 1]});
  drawLines([{
    ...lineData,
    translate: [0, -0.4],
    cap: 'round',
    join: 'round'
  }, {
    ...lineData,
    translate: [0, 0.4],
    cap: 'round',
    join: 'miter'
  }]);
}

draw();
window.addEventListener('resize', draw);
