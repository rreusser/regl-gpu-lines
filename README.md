# [WIP] regl-gpu-lines

> Pure GPU line drawing for [regl](https://github.com/regl-project/regl)

This module configures a command for drawing basic lines using the [regl](https://github.com/regl-project/regl) WebGL library. It focuses specifically on the case of drawing lines without the data ever touching the CPU.

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
  segments: {
    xy: regl.buffer(xy),
    count: xy.length
  },
  endpoints: {
    xy: regl.buffer([xy.slice(0, 3), xy.slice(-3).reverse()]),
    count: 2
  }
};

drawLines(lineData);
```

## Install

Install from npm (WIP; will be published soon)

```bash
npm install regl-gpu-lines
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
- `segments` (object):  
- `endpoints` (object):


## License

&copy; 2021 Ricky Reusser. MIT License
