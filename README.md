# [WIP] regl-gpu-lines

> Pure GPU line drawing for [regl](https://github.com/regl-project/regl)

This module configures a command for drawing lines using the [regl](https://github.com/regl-project/regl) WebGL library. Its specific goals are:
1. data must not touch the CPU
2. no unnecessary constraints. This means projection, colors, blending, attributes, etc. are up to you.
The second is the real reason for this module. It sits on the edge but tries to err on the side of being more of a data flow framework for line rendering with which you can build the line rendering you require.

## See also

- [regl-line2d](https://github.com/gl-vis/regl-line2d): Line rendering library used by Plotly.js. If you want production quality lines, you should go here.
- [regl-line](https://www.npmjs.com/package/regl-line): Another excellent library. A regl function to draw flat 2D and 3D lines.

## Install

Install from npm (WIP; will be published soon)

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
  segmentCount: xy.length,
  segmentBuffers: {
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
import { createDrawLines } from 'regl-gpu-lines';
```

### `createDrawLines(regl, {vert, frag, debug})`

Creates a regl drawing command for drawing lines using the specified shaders.

- `regl`: [regl](https://github.com/regl-project/regl) instance
- `vert` (string): vertex shader, using pragma specification defined below
- `frag` (string): fragment shader
- `debug`: Debug mode, which exposes additional properties for viewing triangle mesh

### Vertex shader data flow

This module uses carefully constructed data flow to pass the same attribute with different offsets, so that miters and positions may be computed in the vertex shader. So that you can still extend the shader and modify it to suit your needs, the module uses GLSL `#pragma` directive to define data flow.

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
- `segmentCount` (number): Total number of line segment vertices (including endpoint vertices)
- `endpointCount` (object): Total number of endpoints drawn (number of endpoint vertices divided by three)
- `segmentBuffers`: (object): Object containing regl buffer objects for each line segment vertex attribute, indexed by attribute name
- `endpointBuffers`: (object): Object containing regl buffer objects for each line endpoint vertex attribute, indexed by attribute name

## License

&copy; 2021 Ricky Reusser. MIT License
