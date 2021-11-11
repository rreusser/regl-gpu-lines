function mat2create() { return [1, 0, 0, 1]; }
function mat2rotate(out, a, rad) {
  var a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3];
  var s = Math.sin(rad);
  var c = Math.cos(rad);
  out[0] = a0 *  c + a2 * s;
  out[1] = a1 *  c + a3 * s;
  out[2] = a0 * -s + a2 * c;
  out[3] = a1 * -s + a3 * c;
  return out;
}

const regl = createREGL({
  extensions: ['ANGLE_instanced_arrays'],
  attributes: {antialias: false},
});

// Instantiate a command for drawing lines
const drawLines = reglLines(regl, {
  vert: `
    precision highp float;

    #pragma lines: attribute vec3 xy;
    #pragma lines: position = getPosition(xy);
    #pragma lines: varying vec2 position = getXY(xy);
    uniform mat2 transform;
    uniform vec2 aspect;
    vec4 getPosition(vec3 xy) {
      return vec4((transform * (xy.xy * 0.03)) * aspect, 0, 1);
    }
    vec2 getXY(vec3 xy) { return xy.xy; }

    #pragma lines: varying float t = getT(xy);
    float getT(vec3 xy) { return xy.z; }

    // Return the line width from a uniorm
    #pragma lines: width = getWidth();
    uniform lowp float width;
    float getWidth() {
      return width;
    }`,
  frag: `
    precision lowp float;
    varying float t;
    varying vec2 lineCoord;
    varying vec2 position;
    uniform vec3 color;
    uniform lowp float width;
    uniform float pixelRatio;
    float linearstep(float a, float b, float x) { return clamp((x - a) / (b - a), 0.0, 1.0); }
    void main () {
      float sdf = width * abs(lineCoord.y);
      float alpha = linearstep(width, width - 1.0, sdf);
      float c = fract(t);
      if (c > 1.0 / 3.0 || alpha < 0.2) discard;
      alpha *= smoothstep(34.0, 29.0, length(position)) * 0.7;
      gl_FragColor = vec4(color, alpha);
    }`,

  // Multiply the width by the pixel ratio for consistent width
  uniforms: {
    color: regl.prop('color'),
    transform: regl.prop('transform'),
    pixelRatio: regl.context('pixelRatio'),
    width: (ctx, props) => {
      return Math.min(ctx.viewportWidth, ctx.viewportHeight) / 300;
    },
    aspect: ctx => ctx.viewportWidth > ctx.viewportHeight
      ? [ctx.viewportHeight / ctx.viewportWidth, 1]
      : [1, ctx.viewportWidth / ctx.viewportHeight],
  },

  blend: {
    enable: true,
    func: {
      srcRGB: 'src alpha',
      srcAlpha: 1,
      dstRGB: 1,
      dstAlpha: 1
    }
  },

  depth: {enable: true}
});

let xy = [];

const yShift = Math.sin(Math.PI / 3);
const unit = [[0, 0], [1 - Math.cos(Math.PI / 3), Math.sin(Math.PI / 3)]]
let c = 0;
const t = [];
const rows = 20;
const cols = 11;

for (let k = -cols; k <=cols; k++) {
  for (let j of [-1, 1]) {
    for (let i = -rows; i <= rows; i++) {
      const pt = unit.map(([x, y]) => [
        x + j * 0.75 + k * 3 - 0.25,
        (y + i * yShift * 2) * j - yShift * 0.5
          - j * yShift * 0.5,
        -1,
      ]);

      if (Math.hypot(pt[0][0], pt[0][1]) > 36.0) continue;
      xy.push(pt);
    }
  }
}

for (let j = rows; j >= -rows; j--) {
  const x1 = cols * 3 + 1.25;
  const e = 0.5;
  const shift = 1.5;
  const dx = -0.25;
  const dy = -yShift * 0.25;
  const extent = 2 * cols + 1;
  xy.push([
    [x1 + dx, j + dy, extent],
    [-x1 - e + dx, j + dy, 0],
    [-x1 - e + dx + shift, j - 0.5 + dy, 0],
    [x1 + dx + shift, j - 0.5 + dy, extent]
  ].map(([x, y, z]) => [
    x,
    (y + 0.25) * yShift * 2,
    z
  ]));
}

// Center it about zero
xy = xy.flat();
xy.reverse();

// Set up the data to be drawn. Note that we preallocate buffers and don't create
// them on every draw call.
const lineData = {
  roundResolution: 1,
  join: 'round',
  cap: 'square',
  vertexCount: xy.length,
  vertexAttributes: {
    xy: regl.buffer(xy),
  }
};



const colors = [
  [1, 0, 0.5],
  [0.5, 1, 0],
  [0, 0.5, 1]
];
regl.frame(({time}) => {
  regl.poll();
  regl.clear({color: [0.2, 0.2, 0.2, 1]});
  [0, 0.1, 0.2].forEach((rate, i) => {
    regl.clear({depth: 1});
    drawLines({
      ...lineData,
      transform: mat2rotate([], mat2create(), time * rate),
      color: colors[i]
    })
  });
});
