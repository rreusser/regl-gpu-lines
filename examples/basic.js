const createREGL = require('regl');
const createDrawLines = require('../src/index.js');

const regl = createREGL({
  extensions: ['ANGLE_instanced_arrays'],
});

const drawLines = createDrawLines(regl, {
  vert: `
    precision highp float;

    #pragma lines: attribute float x
    #pragma lines: attribute vec3 color
    #pragma lines: position = getPosition(x)
    #pragma lines: width = getWidth()
    #pragma lines: varying vec3 color = getColor(color)

    uniform float width;

    vec4 getPosition (float x) {
      return vec4(x, 0.8 * sin(20.0 * x) * exp(-x * x * 6.0), 0, 1);
    }

    float getWidth () {
      return width;
    }

    vec3 getColor (vec3 col) {
      return col;
    }`,
  frag: `
    precision mediump float;
    varying vec3 color;
    void main () {
      gl_FragColor = vec4(color, 1);
    }`
});

const lineConfig = regl({
  uniforms: {
    width: (ctx, props) => ctx.pixelRatio * props.width,
  },
  depth: {enable: false}
})

const n = 21;
const x = [...Array(n).keys()].map(i => (i / (n - 1) * 2 - 1) * 0.8);
const color = x.map(x => [0, 1, 2].map(i => 0.5 + Math.cos(x * 4 - i * 2 * Math.PI / 3)));

const lineData = {
  join: 'round',
  cap: 'square',
  joinResolution: 8,
  capResolution: 12,
  segments: {
    x: regl.buffer(x),
    color: regl.buffer(color),
    count: x.length
  },
  endpoints: {
    x: regl.buffer([x.slice(0, 3), x.slice(-3).reverse()]),
    color: regl.buffer([color.slice(0, 3), color.slice(-3).reverse()]),
    count: 2
  }
};

function draw () {
  regl.poll();
  regl.clear({color: [0.2, 0.2, 0.2, 1]});

  lineConfig({width: 25}, () => drawLines(lineData));
}

draw();
window.addEventListener('resize', draw);
