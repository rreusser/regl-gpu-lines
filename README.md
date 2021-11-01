# [WIP] regl-gpu-lines

> Pure GPU line drawing for [regl](https://github.com/regl-project/regl)

This module configures a very general command for drawing lines using the [regl](https://github.com/regl-project/regl) WebGL library. Its specific goals are:

- Data must not touch the CPU.
- No unnecessary constraints.

This second point means that projection, colors, blending, and even GLSL attributes and varyings are up to you. In this sense it's almost more of a data flow framework for line rendering with which you can build the line rendering you require.

<p align="center">
  <img src="./docs/round.png" alt="Lines with round joins and caps" width="400">
</div>

## See also

- [regl-line2d](https://github.com/gl-vis/regl-line2d): The line rendering library used by Plotly.js. If you want production quality lines, you should go here.
- [regl-line](https://www.npmjs.com/package/regl-line): Another excellent library. A regl function to draw flat 2D and 3D lines.

## Install

Install from npm.

```bash
npm install regl-gpu-lines
```

## Example

```js
import createREGL from 'regl';
import createDrawLines from 'regl-gpu-lines';

const regl = createREGL();

const drawLines = createDrawLines(regl, {
  vert: `
    precision highp float;

    #pragma lines: attribute vec2 xy;
    #pragma lines: position = getPosition(xy);
    #pragma lines: width = getWidth();

    vec4 getPosition(vec2 xy) { return vec4(xy, 0, 1); }
    float getWidth() { return 10.0; }`,
  frag: `
    precision lowp float;
    void main () {
      gl_FragColor = vec4(1);
    }`
});

const xy = [...Array(10).keys()].map(i => i / 9).map(t => [t, Math.sin(t)]);

const lineData = {
  join: 'round',
  cap: 'square',
  joinResolution: 8,
  vertexCount: xy.length,
  vertexBuffers: {
    xy: regl.buffer(xy)
  },
  endpointCount: 2,
  endpointBufferss: {
    xy: regl.buffer([xy.slice(0, 3), xy.slice(-3).reverse()])
  }
};

drawLines(lineData);
```

## API

```js
import createDrawLines from 'regl-gpu-lines';
```

### `createDrawLines(regl, {vert, frag, debug})`

Instantiate a drawing command using the specified shaders.

- `regl`: [regl](https://github.com/regl-project/regl) instance
- `vert` (string): vertex shader, using pragma specification defined below
- `frag` (string): fragment shader
- `debug`: Debug mode, which exposes additional properties for viewing triangle mesh

### Vertex shader data flow

This module parses the specified vertex shader for GLSL `#pragma` directives which define the line properties and data flow.

#### `#pragma lines: attribute <dataType> <attributeName>`
- `dataType`: one of `float`, `vec2`, `vec3`, `vec4`
- `attributeName`: name of attribute provided to draw command

#### `#pragma lines: position = <functionName>(<attributeList>)`
- `functionName`: name of function which returns the `vec4` position of the vertex
- `attributeList`: vertex attributes passed to the function

#### `#pragma lines: width = <functionName>(<attributeList>)`
- `functionName`: name of function which returns the `float` device pixel width of the line at the given vertex
- `attributeList`: vertex attributes passed to the function

#### `#pragma lines: varying <type> <name> = <functionName>(<attributeList>)
- `type`: type of varying parameter passed to fragment shader. One of `float`, `vec2`, `vec3`, vec4`.
- `name`: name of varying parameter passed to fragment shader
- `attributeList`: vertex attributes passed to the function


### Drawing lines

- `join` (string): `'round' | 'miter' | 'bevel'`
- `cap` (string): `'round' | 'square' | 'none'`
- `joinResolution` (number): number of triangles used to construct rounded joins
- `capResolution` (number): number of triangles used to construct rounded end caps
- `miterLimit` (number): Maximum extension of miter joins, in multiples of line widths, before they fall back to bevel joins.
- `vertexCount` (number): Total number of line segment vertices (including endpoint vertices)
- `endpointCount` (object): Total number of endpoints drawn (number of endpoint vertices divided by three)
- `vertexBuffers`: (object): Object containing regl buffer objects for each line segment vertex attribute, indexed by attribute name
- `endpointBuffers`: (object): Object containing regl buffer objects for each line endpoint vertex attribute, indexed by attribute name

## License

&copy; 2021 Ricky Reusser. MIT License
