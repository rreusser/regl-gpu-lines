# API

- [Draw command constructor](#draw-command-constructor)
- [Vertex shader data flow](#vertex-shader-data-flow)
  - [attribute](#vertex-attributes-required)
  - [position](#vertex-position-required)
  - [width](#line-width-required)
  - [orientation](#end-cap-orientation-optional)
  - [varying](#varyings-optional)
- [Fragment shader](#fragment-shader)
  - [lineCoord](#fragment-shader)
- [Drawing lines](#drawing-lines)

## Draw command constructor

```js
import reglLines from 'regl-gpu-lines';
```

## `reglLines(regl, {vert, frag, reorder, debug, ...})`

Instantiate a drawing command using the specified shaders.

- `regl`: [regl](https://github.com/regl-project/regl) instance
- `vert` (string): vertex shader, using pragma specification defined below
- `frag` (string): fragment shader
- `debug`: (boolean, default: `false`) Debug mode, which exposes additional properties for viewing triangle mesh
- `reorder`: (boolean, default: `true`) Reorder draw calls to optimize rendering. Applies only when drawing is invoked with an array of line properties, e.g. `drawLines([{...}, {...}, ...])`.

Additional configuration parameters are forwarded to a `regl` command which wraps drawing.

---

## Vertex shader data flow

The vertex shader is parsed for GLSL `#pragma` directives which define data flow as well as line properties.

### Vertex attributes *(at least one required)*
#### `#pragma lines: attribute <dataType> <attributeName>`
- `dataType`: one of `float`, `vec2`, `vec3`, `vec4`
- `attributeName`: name of attribute provided to draw command

### Vertex position *(required)*
A fixed property which defines computation of the `vec4` position of line vertices. Perspective division is performed automatically. Signal line breaks by returning a `vec4` with `w = 0.0` or position.x `NaN`. Unless using `insertCaps`, it is up to you to supply the corresponding endpoint data wherever this is a break.
#### `#pragma lines: position = <functionName>(<attributeList>)`
- `functionName`: name of GLSL function which returns the `vec4`-valued position of the vertex
- `attributeList`: comma-separated list of vertex attribute names passed to the function

### Line width *(required)*
A fixed property which defines the width at a given vertex, measured in device pixels. If you want the width consistent across devices, it is up to you to multiply it by the regl context's `pixelRatio`.
#### `#pragma lines: width = <functionName>(<attributeList>)`
- `functionName`: name of GLSL function which returns the `float`-valued device pixel width of the line at the given vertex
- `attributeList`: comman-separated list of vertex attributes passed to the function

### End cap orientation *(optional)*
A fixed property which defines whether a given line cap is at the beginning or end of a line. If `orientation` is not provided, then end caps are rendered in two passes, first starting line caps, then ending line caps. If provided, then end caps are rendered in a single pass. (This complication results from the fact that there's no mechanism to tell which instance we're on, for example with `gl_InstanceID` which does not exist in GLSL ES 1.00.)
#### `#pragma lines: orientation = <functionName>(<attributeList>)`
- `functionName`: name of GLSL function which returns a `float`, `reglLines.START_CAP` (`0.0`) if the cap is a start cap and `reglLines.END_CAP` (`1.0`) if an end cap.
- `attributeList`: command-separated list of vertex attributes passed to the function. Attributes consumed by a `orientation` function advance at a rate of one stride per instance.

### Varyings *(optional)*
#### `#pragma lines: [extrapolate] varying <type> <name> = <functionName>(<attributeList>)`
- `extrapolate`: optional keyword to indicate that the varying should be extrapolated in caps and joins. Otherwise the varying is clamped to lie within the range defined by the values at either end of the segment.
- `type`: type of varying parameter passed to fragment shader. One of `float`, `vec2`, `vec3`, vec4`.
- `name`: name of varying parameter passed to fragment shader
- `functionName`: name of GLSL function which receives the attribute values and returns the varying of the specified type
- `attributeList`: vertex attributes passed to the function

---

## Fragment shader

You may define the fragment shader as you desire. The only builtin parameter is a `varying vec3` called `lineCoord`, which assists in rendering end caps and variation across the width of the line. `lineCoord.xy` lives in the square [-1, 1] &times; [-1, 1]. Starting caps lie in the left half-plane, [-1, 0] &times; [-1, 1]. The full length of the line lies along a vertical slice [0] &times; [-1, 1]. End caps lie in the right half-plane, [0, 1] &times; [-1, 1]. `lineCoord.z` is zero on line segments and is non-zero on caps and joins. This can help to render caps and joins differently, for example so that caps and joins would not entirely disappear when rendering dashed lines.

---

## Drawing lines

Drawing is invoked by passing an object with the following optional properties to the constructed draw command.

### `drawLines({...})`

| Property | Type | Default | Description |
| -------- | ---- | ------- | ----------- |
| `join` | `'miter'` `'bevel'` `'round'` | `'miter'` | Type of joins |
| `cap` | `'square'` `'round'` `'none'` | `'square'` | Type of end caps | 
| `joinResolution` | `number` (1-20) | 8 | Number of triangles used to construct round joins | 
| `capResolution` | `number` (1-20) | 12 | Number of triangles used to construct round end caps | 
| `insertCaps` | `boolean` | `false` | Automatically insert caps at line breaks |
| `miterLimit` | `number` | 4 | Maximum extension of miter joins, in multiples of line widths, before they fall back to bevel joins |
| `vertexCount` | `number` | 0 | Total number of line vertices |
| `endpointCount` | `number` | 0 | Number end caps drawn (number of endpoint vertices divided by three) |
| `vertexAttribues` | `object` | `{}` | Object of named attributes corresponding to those defined the vertex shader |
| `endpointAttributes` | `object` | `{}` | Object of named attributes corresponding to those defined the vertex shader |

### Notes
- `endpointAttributes` requires all attributes used in the computation of `orientation`, but `vertexAttributes` may exclude them.
- If either `endpointAttributes` or `vertexAttributes` is excluded, the corresponding geometry will not be rendered
- You must at least provide regl buffer objects, but in the style of regl, you may either just provide a buffer, or you may provide an object of the form `{buffer, stride, offset, divisor, type}`.
- `insertCaps` automatically inserts a cap wherever a break is encountered, signaled by a position with `w = 0` or first component `NaN`. Allows drawing lines and caps with a single draw call. *Use this option with care.* To avoid wasting vertices on degenerate triangles when caps are not drawn, use `capResolution ≤ joinResolution`.
