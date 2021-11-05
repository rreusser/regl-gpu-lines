const regl = createREGL({
  extensions: ['ANGLE_instanced_arrays'],
  attributes: {antialias: false}
});

// Instantiate a command for drawing lines
const drawLines = reglLines(regl, {
  vert: `
    precision highp float;

    uniform float width, time, phase;

    #pragma lines: attribute float x;
    #pragma lines: position = getPosition(x);
    vec4 getPosition(float x) {
      float theta = 3.141 * (6.0 * x + time) - phase;
      return vec4(
        0.5 * vec3(
          cos(theta),
          (x * 2.0 - 1.0) * 1.5,
          sin(theta)
        ),
        1
      );
    }

    // Return the line width from a uniorm
    #pragma lines: width = getWidth();
    float getWidth() {
      return width;
    }`,
  frag: `
    precision highp float;
    uniform float width, borderWidth;
    uniform vec3 color;
    varying vec2 lineCoord;
    void main () {
      // Convert the line coord into an SDF
      float sdf = length(lineCoord) * width;

      // Apply a border with 1px transition
      gl_FragColor = vec4(
        mix(color, vec3(1), smoothstep(width - borderWidth - 0.5, width - borderWidth + 0.5, sdf)),
        1);
    }`,

  // Multiply the width by the pixel ratio for consistent width
  uniforms: {
    width: (ctx, props) => ctx.pixelRatio * props.width,
    borderWidth: (ctx, props) => ctx.pixelRatio * props.borderWidth,
    time: regl.context('time'),
    phase: regl.prop('phase'),
    color: regl.prop('color')
  },

  depth: {enable: true}
});

const n = 101;
const x = [...Array(n).keys()].map(i => i / (n - 1));

// Set up the data to be drawn. Note that we preallocate buffers and don't create
// them on every draw call.
const lineData = {
  width: 30,
  join: 'bevel',
  cap: 'round',
  vertexCount: x.length,
  vertexAttributes: { x: regl.buffer(x) },
  endpointCount: 2,
  endpointAttributes: { x: regl.buffer([x.slice(0, 3), x.slice(-3).reverse()]) },
  borderWidth: 5
};

regl.frame(() => {
  regl.clear({color: [0.2, 0.2, 0.2, 1]});
  drawLines([
    {...lineData, phase: 0, color: [1, 0, 0]},
    {...lineData, phase: Math.PI / 2, color: [0, 0, 1]}
  ]);
});