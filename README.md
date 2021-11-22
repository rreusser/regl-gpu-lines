<p align="center">
  <img src="./docs/debug.png" alt="Lines with round joins and caps" width="600">
</p>

# regl-gpu-lines

> Pure GPU, instanced, screen-projected lines for [regl](https://github.com/regl-project/regl)

[API documentation &rarr;](./docs/API.md)

[Live example &rarr;](https://rreusser.github.io/regl-gpu-lines/docs/debug.html)

[All examples &rarr;](#examples)

This module implements a very general command for drawing lines using the [regl](https://github.com/regl-project/regl) WebGL library.

Architecturally this module has two goals:
- **Data may live on the GPU.**
- **Minimize unnecessary constraints.**

To accomplish this, it implements a simple pragma-based interface for specifying how your attributes connect to line properties and to varyings.

Features:

- Configure your own attributes, varyings, uniforms, and shaders
- Compute position and line width in the vertex shader
- GPU computation of round joins, bevels, and miters (with miter limit), and square and rounded end caps.
- Optional end cap insertion, using `position.w == 0.0` or alternatively `position.x` NaN to signal a line break (see: [docs/multiple.html](https://rreusser.github.io/regl-gpu-lines/docs/multiple.html)) 
- Regl-compatible attribute specification with strides and offsets
- Forward additional regl configuration to the draw command
- Seamlessly permits substitution of Vertex Array Objects (VAOs)
- 13.4 KB minified, 5.3 KB gzipped. No dependencies (although it is expected to be used together with regl, which requirement I'd like to [consider removing](https://github.com/rreusser/regl-gpu-lines/issues/7))

Limitations:

- `ANGLE_instanced_arrays` extension is required (which ought to be [universally supported](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices#understand_extension_availability))
- Width is best varied slowly as line joins to not take into account varying width
- Automatic end cap insertion wastes vertices when the cap resolution exceeds the join resolution
- Line dashes are not built-in, but you can easily build them yourself

## Install

The `dist/` directory contains UMD bundles, or you may use from a CDN, e.g. [https://unpkg.com/regl-gpu-lines@latest](https://unpkg.com/regl-gpu-lines@latest). Both expose the module as `reglLines`.

Otherwise install from npm:

```bash
npm install regl-gpu-lines
```

## API

See [API documentation](./docs/API.md).

## Examples

- [Basic example](https://rreusser.github.io/regl-gpu-lines/docs/basic.html): A minimal example. Just a line.
- [Variable width](https://rreusser.github.io/regl-gpu-lines/docs/variable-width.html): A basic line with variable width and color
- [Multiple lines](https://rreusser.github.io/regl-gpu-lines/docs/multiple.html): Use position NaN to break up lines into multiple segments
- [Depth](https://rreusser.github.io/regl-gpu-lines/docs/depth.html): Layer lines using the z-coordinate
- [Closed loop](https://rreusser.github.io/regl-gpu-lines/docs/closed-loop.html): Create a closed loop by omitting end caps and repeating the first three vertices at the end.
- [Line border](https://rreusser.github.io/regl-gpu-lines/docs/border.html): Use `lineCoord` to draw a SDF line border
- [Interleaved attributes](https://rreusser.github.io/regl-gpu-lines/docs/strided.html): Instead of a [regl buffer](https://github.com/regl-project/regl/blob/master/API.md#buffers), you can pass a [regl-style attribute description](https://github.com/regl-project/regl/blob/master/API.md#attributes) with `buffer`, `stride`, `offset`, and `divisor` properties in order to used interleaved, packed attribute data.
- [Torus knot](https://rreusser.github.io/regl-gpu-lines/docs/knot.html): A [torus knot](https://en.wikipedia.org/wiki/Torus_knot) with layering which can be difficult to draw with SVG.
- [Batched rendering](https://rreusser.github.io/regl-gpu-lines/docs/batching.html): Illustrates how to take advantage of `reorder: true` to reduce shader program changes from, in this example, thirty to four.
- [Post-projection](https://rreusser.github.io/regl-gpu-lines/docs/postproject.html): Illustrates post-project to draw lines projected onto a plane from some other angle.
- [Vertex Array Object (VAO)](https://rreusser.github.io/regl-gpu-lines/docs/vao.html): Illustrates seamless swapping of VAO for vertex and endpoint attributes.
- [Debug page](https://rreusser.github.io/regl-gpu-lines/docs/debug-view.html): Shows how to use `instanceID` and `triStripCoord` varyings to draw a wireframe
- [Full debug view](https://rreusser.github.io/regl-gpu-lines/docs/debug.html): A page for exploring all the bells and whistles
- [GPGPU Strange Attractors](https://observablehq.com/d/ab6cd8bb0137889c): Feed a GPU particle simulation from texture data directly into line rendering

<p align="center">
  <a href="https://observablehq.com/d/ab6cd8bb0137889c"><img src="./docs/lorenz.gif" alt="GPGPU Lorenz Attractor"></a>
</p>

A minimal example looks like the following, where a `vec2` attribute `xy` is connected to line position via a GLSL `#pragma`.

```js
const drawLines = reglLines(regl, {
  vert: `
    precision highp float;

    #pragma lines: attribute vec2 xy;
    #pragma lines: position = getPosition(xy);
    vec4 getPosition(vec2 xy) { return vec4(xy, 0, 1); }

    #pragma lines: width = getWidth();
    uniform float width;
    float getWidth() { return width; }`,
  frag: `
    precision lowp float;
    void main () {
      gl_FragColor = vec4(1);
    }`,
  uniforms: {
    width: (ctx, props) => props.customWidth * ctx.pixelRatio
  }
});

const xy = [[-1, 1], [-0.5, -1], [0, 1], [0.5, -1], [1, 1]];
const lineData = {
  customWidth: 20,
  join: 'round',
  cap: 'round',
  vertexCount: xy.length,
  vertexAttributes: {
    xy: regl.buffer(xy)
  },
  endpointCount: 2,
  endpointAttributes: {
    xy: regl.buffer([xy.slice(0, 3), xy.slice(-3).reverse()])
  }
};

drawLines(lineData);
```

## Development

### Examples

Serve example pages—e.g. the example in `examples/closed-loop.js`—with

```bash
npm start closed-loop
```

### Tests

Run live-reloading render tests with

```bash
npm run serve-render-tests
```

Executing the render tests from the CLI requires the [headless-gl](https://www.npmjs.com/package/gl) module. You may use [nodemon](https://www.npmjs.com/package/nodemon) to live-run the render tests when the code is changed.

```bash
npm install -g nodemon
nodemon test/render.js
```

Filter tests with

```bash
FILTER=miter/basic nodemon test/render.js
```

and update expectation images with

```bash
UPDATE=1 FILTER=miter/basic node test/render.js
```

You may view the tests, run against the latest version from unpkg.com, at https://rreusser.github.io/regl-gpu-lines/docs/tests.html

## See also

- [regl-line2d](https://github.com/gl-vis/regl-line2d): The line rendering library used by Plotly.js. If you want production quality lines, you should go here.
- [regl-line](https://www.npmjs.com/package/regl-line): A regl function to draw flat 2D and 3D lines.
- [regl-insta-lines](https://github.com/deluksic/regl-insta-lines): A very clear and well-written module. Very close to what I was searching for. My main desire was to defer more of the configuration to runtime and to avoid overlap in the miters.
- [screen-projected-lines](https://github.com/substack/screen-projected-lines): An excellent, concise module for screen-projected lines. Without joins or caps, such lines are much simpler.
- [Drawing Lines is Hard](https://mattdesl.svbtle.com/drawing-lines-is-hard): [Matt DesLaurier](https://twitter.com/mattdesl)'s classic post on the topic of drawing lines.
- [Instanced Line Rendering Part I](https://wwwtyro.net/2019/11/18/instanced-lines.html): [Rye Terrell](https://wwwtyro.net/) first blog post on the topic.
- [Instanced Line Rendering Part II: Alpha blending](https://wwwtyro.net/2021/10/01/instanced-lines-part-2.html): [Rye Terrell](https://wwwtyro.net/)'s blog post which inspired me to pare the draw calls down to two and publish this module.

## License

&copy; 2021 Ricky Reusser. MIT License.
