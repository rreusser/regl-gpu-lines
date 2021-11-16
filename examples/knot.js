const regl = createREGL({
  extensions: ['ANGLE_instanced_arrays']
});

// Instantiate a command for drawing lines
const drawLines = reglLines(regl, {
  vert: `
    precision highp float;

    uniform float width, phase;
    uniform vec2 aspect;

    #pragma lines: attribute float theta;
    #pragma lines: position = torusKnot(theta);
    vec4 torusKnot(float theta) {
      const float p = 3.0;
      const float q = 5.0;
      float r = cos(q * theta) + 2.0;
      float phi = p * (theta - phase);
      return vec4(
        vec3(
          aspect * r * vec2(cos(phi), sin(phi)),
          -sin(q * theta)
        ) * 0.25,
        1
      );
    }

    // Return the line width from a uniform
    #pragma lines: width = getWidth();
    float getWidth() { return width; }`,
  frag: `
    precision highp float;
    uniform float width, borderWidth, pixelRatio;
    uniform vec3 color;
    varying vec3 lineCoord;
    void main () {
      // Convert the line coord into an SDF
      float sdf = length(lineCoord.xy) * width;

      // Apply a border with 1px transition
      gl_FragColor = vec4(
        mix(color, vec3(1),
          smoothstep(
            width - borderWidth - 0.5 / pixelRatio,
            width - borderWidth + 0.5 / pixelRatio,
            sdf
          )
        ), 1);
    }`,

  // Multiply the width by the pixel ratio for consistent width
  uniforms: {
    pixelRatio: regl.context('pixelRatio'),
    aspect: ctx => ctx.viewportWidth > ctx.viewportHeight
      ? [ctx.viewportHeight / ctx.viewportWidth, 1]
      : [1, ctx.viewportWidth / ctx.viewportHeight],
    width: (ctx, props) => Math.min(ctx.viewportWidth, ctx.viewportHeight) / 30,
    borderWidth: (ctx, props) => Math.min(ctx.viewportWidth, ctx.viewportHeight) / (30 * 4),
    phase: regl.prop('phase'),
    color: regl.prop('color')
  },

  depth: {enable: true}
});

const n = 501;

// Set up the data to be drawn. Note that we preallocate buffers and don't create
// them on every draw call.
const lineData = {
  join: 'round',
  vertexCount: n + 3,
  vertexAttributes: {
    theta: regl.buffer([...Array(n + 3).keys()].map(i => i / n * Math.PI * 2))
  },
};

function draw() {
  regl.poll();
  regl.clear({color: [0.2, 0.2, 0.2, 1]});
  drawLines([
    {...lineData, phase: 0, color: [1, 0, 0.5]},
    {...lineData, phase: Math.PI, color: [0, 0.5, 1]},
  ]);
}

draw();
window.addEventListener('resize', draw);
