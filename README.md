# regl-gpu-lines

> Pure GPU line drawing for [regl](https://github.com/regl-project/regl)

This module implements a very general command for drawing lines using the [regl](https://github.com/regl-project/regl) WebGL library. Architecturally, it has two goals.

**Data lives on the GPU.** The CPU does not ever need to touch the data. Data lives on the GPU, allowing to draw thousands of separate lines with just two WebGL draw calls.

**Minimize unnecessary constraints.** Although it facilitates setup, projection, colors, blending, and even GLSL attributes and varyings are up to you. Think of it as a data flow framework for line rendering with which you can build the line rendering you require.

<p>
  <div><a href="https://rreusser.github.io/regl-gpu-lines/docs/debug.html">Live demo &rarr;</a></div>
  <div><a href="https://rreusser.github.io/regl-gpu-lines/docs/debug.html">
    <img src="./docs/round.png" alt="Lines with round joins and caps" width="600">
  </a></div>
</p>

Features:

- Configure your own attributes, varyings, uniforms, and fragment shaders
- Round joins, miters, and bevels
- Square and rounded end caps
- Use `NaN` to separate disjoint lines (see: [docs/multiple.html](https://rreusser.github.io/regl-gpu-lines/docs/multiple.html))
- Pass additional regl configuration to the constructor

Limitations:

- Interior miters of sharp-angle corners need better limiting
- Lines with two vertices are rendered as overlapping end caps
- Joins do not take into account variation in width, so varying width is best varied slowly

## See also

- [regl-line2d](https://github.com/gl-vis/regl-line2d): The line rendering library used by Plotly.js. If you want production quality lines, you should go here.
- [regl-line](https://www.npmjs.com/package/regl-line): Another excellent library. A regl function to draw flat 2D and 3D lines.
- [screen-projected-lines](https://github.com/substack/screen-projected-lines): An excellent, concise module for screen-projected lines. Without joins or caps, such lines are much simpler.

## Install

Install from npm.

```bash
npm install regl-gpu-lines
```

## Example

The following code implements the image shown below. It passes a single attribute and uses preprocessor directives to connect it to the line width and position, as well as to pass the x-component to the fragment shader for coloring.

<p>
  <div><a href="https://rreusser.github.io/regl-gpu-lines/docs/index.html">Live demo &rarr;</a></div>
  <div><a href="https://rreusser.github.io/regl-gpu-lines/docs/index.html">
    <img src="./docs/example.png" alt="Basic example" width="600">
  </a></div>
</p>

```js
const regl = createREGL({extensions: ['ANGLE_instanced_arrays']});

const drawLines = createDrawLines(regl, {
  vert: `
    precision highp float;

    #pragma lines: attribute vec2 xy;
    #pragma lines: position = getPosition(xy);
    #pragma lines: width = getWidth(xy);
    #pragma lines: varying float x = getX(xy);

    uniform float width;

    vec4 getPosition(vec2 xy) { return vec4(xy, 0, 1); }
    float getWidth(vec2 xy) { return width * (0.5 + 0.4 * cos(16.0 * xy.x)); }
    float getX(vec2 xy) { return xy.x; }`,
  frag: `
    precision lowp float;
    varying float x;
    void main () {
      gl_FragColor = vec4(0.5 + cos(8.0 * (x - vec3(0, 1, 2) * 3.141 / 3.0)), 1);
    }`,
  uniforms: {
    width: regl.prop('width')
  }
});

const n = 101;
const xy = [...Array(n).keys()]
  .map(i => (i / (n - 1) * 2.0 - 1.0) * 0.8)
  .map(t => [t, 0.5 * Math.sin(8.0 * t)]);

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
  width: 50
};

function draw () {
  regl.poll();
  regl.clear({color: [0.2, 0.2, 0.2, 1]});
  drawLines(lineData);
}

draw();
```

## API

```js
import createDrawLines from 'regl-gpu-lines';
```

### `createDrawLines(regl, {vert, frag, debug, ...})`

Instantiate a drawing command using the specified shaders.

- `regl`: [regl](https://github.com/regl-project/regl) instance
- `vert` (string): vertex shader, using pragma specification defined below
- `frag` (string): fragment shader
- `debug`: Debug mode, which exposes additional properties for viewing triangle mesh

Additional configuration parameters are forwarded to a `regl` command which wraps drawing.

---

### Vertex shader data flow

The vertex shader is parsed for GLSL `#pragma` directives which define data flow as well as line properties.

#### Vertex attributes *(required)*
##### `#pragma lines: attribute <dataType> <attributeName>`
- `dataType`: one of `float`, `vec2`, `vec3`, `vec4`
- `attributeName`: name of attribute provided to draw command

#### Vertex position *(required)*
A fixed property which defines computation of the `vec4` position of line vertices. Perspective division is performed automatically.
##### `#pragma lines: position = <functionName>(<attributeList>)`
- `functionName`: name of function which returns the `vec4`-valued position of the vertex
- `attributeList`: comma-separated list of vertex attribute names passed to the function

#### Line width *(required)*
A fixed property which defines the width at a given vertex, measured in device pixels. If you want the width consistent across devices, it is up to you to multiply it by the regl context's `pixelRatio`.
##### `#pragma lines: width = <functionName>(<attributeList>)`
- `functionName`: name of function which returns the `float`-valued device pixel width of the line at the given vertex
- `attributeList`: comman-separated list of vertex attributes passed to the function

#### End cap orientation *(optional)*
A fixed property which defines whether a given line cap is at the beginning or end of a line. If `startcap` is not provided, then end caps are rendered in two passes, first starting caps, then ending caps. If provided, then end caps are rendered in a single pass.
##### `#pragma lines: startcap = <functionName>(<attributeList>)`
- `functionName`: name of function which returns a `bool`, `true` if the cap is at the beginning of a line and `false` otherwise.
- `attributeList`: command-separated list of vertex attributes passed to the function. Attributes consumed by a `startcap` function advance at a rate of one stride per instance.

#### Varyings *(optional)*
##### `#pragma lines: varying <type> <name> = <functionName>(<attributeList>)`
- `type`: type of varying parameter passed to fragment shader. One of `float`, `vec2`, `vec3`, vec4`.
- `name`: name of varying parameter passed to fragment shader
- `attributeList`: vertex attributes passed to the function

---

### Fragment shader

You may define the fragment shader as you desire. The only builtin parameter is a `varying vec2` called `lineCoord`, which assists in rendering end caps and variation across the width of the line. `lineCoord` lives in the square [-1, 1] &times; [-1, 1]. Starting caps lie in the left half-plane, [-1, 0] &times; [-1, 1]. The full length of the line lies along a vertical slice [0] &times; [-1, 1]. End caps lie in the right half-plane, [0, 1] &times; [-1, 1].

---

### Drawing lines

Drawing is invoked by passing an object with the following optional properties to the constructed draw command.

#### `drawLines({...})`

| Property | Type | Default | Description |
| -------- | ---- | ------- | ----------- |
| `join` | `'miter'` `'bevel'` `'round'` | `'miter'` | Type of joins |
| `cap` | `'square'` `'round'` `'none'` | `'square'` | Type of end caps | 
| `joinResolution` | `number` | 8 | Number of triangles used to construct round joins | 
| `capResolution` | `number` | 12 | Number of triangles used to construct round end caps | 
| `miterLimit` | `number` | 4 | Maximum extension of miter joins, in multiples of line widths, before they fall back to bevel joins. |
| `vertexCount` | `number` | 0 | Total number of line vertices |
| `endpointCount` | `number` | 0 | Number end caps drawn (number of endpoint vertices divided by three) |
| `vertexAttribues` | `object` | `{}` | Object of named attributes corresponding to those defined the vertex shader |
| `endpointAttributes` | `object` | `{}` | Object of named attributes corresponding to those defined the vertex shader |

#### Notes
- `endpointAttributes` requires all attributes used in the computation of `isstart`, but `vertexAttributes` may exclude them.
- If either `endpointAttributes` or `vertexAttributes` is exluded, the geometry will not be rendered

## License

&copy; 2021 Ricky Reusser. MIT License
