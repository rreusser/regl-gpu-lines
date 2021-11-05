const regl = createREGL({extensions: ['ANGLE_instanced_arrays']});

const drawLines = reglLines(regl, {
  vert: `
    precision highp float;

    #pragma lines: attribute vec2 xy;
    #pragma lines: position = getPosition(xy);
    #pragma lines: width = getWidth(xy);

    uniform vec2 aspect;

    vec4 getPosition(vec2 xy) { return vec4(xy * aspect, 0, 1); }
    float getWidth(vec2 xy) { return 50.0; }
    `,
  frag: `
    precision lowp float;
    void main () {
      gl_FragColor = vec4(vec3(1), 0.5);
    }`,
  uniforms: {
    aspect: ctx => [1, ctx.framebufferWidth / ctx.framebufferHeight]
  },
  blend: {
    enable: true,
    func: {
      srcRGB: 'src alpha',
      srcAlpha: 1,
      dstRGB: 'one minus src alpha',
      dstAlpha: 1
    }
  },
  depth: {
    enable: false
  }
});

// A seven-sided star
const n = 7;

// Except we repeat the first three vertices again at the end. This
// results in a closed shape with correct joins.
const xy = [...Array(n + 3).keys()]
  .map(i => i / n)
  .map(t => {
    const theta = t * Math.PI * 2 * 2;
    const r = 0.7;
    return [
      r * Math.cos(theta),
      r * Math.sin(theta)
    ];
  });

// Exclude endpointAttributes since there are no end caps to draw in
// this case.
const lineData = {
  join: 'round',
  vertexCount: xy.length,
  vertexAttributes: {
    xy: regl.buffer(xy)
  },
};

function draw () {
  regl.poll();
  regl.clear({color: [0.2, 0.2, 0.2, 1]});
  drawLines(lineData);
}

draw();
window.addEventListener('resize', draw);
