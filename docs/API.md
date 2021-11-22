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
  - [Vertex Array Objects](#vertex-array-objects)

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

---

### Vertex attributes *(at least one required)*

Attributes represent per-vertex data. This module internally decides how many times to pass each attribute—between one and four times and each time with a different offset, and depending on its required usage in computing various properties.

#### `#pragma lines: attribute <dataType> <attributeName>`
- `dataType`: one of `float`, `vec2`, `vec3`, `vec4`
- `attributeName`: name of attribute provided to draw command

#### Example

```glsl
#pragma lines: attribute vec4 position
#pragma lines: attribute vec3 color
#pragma lines: attribute float alpha
```

---

### Vertex position *(required)*
#### `#pragma lines: position = <functionName>(<attributeList>)`
- `functionName`: name of GLSL function which returns the `vec4`-valued position of the vertex
- `attributeList`: comma-separated list of vertex attribute names passed to the function
A fixed property which defines computation of the `vec4` position of line vertices. Perspective division is performed automatically. Signal line breaks by returning a `vec4` with `w = 0.0` or position.x `NaN`. Unless using `insertCaps`, it is up to you to supply the corresponding endpoint data wherever this is a break.

#### Example

```glsl
#pragma lines: attribute vec2 xy
#pragma lines: attribute float z
#pragma lines: position = computePosition(xy, z)

vec4 computePosition(vec2 xy, float z) { return vec4(xy, z, 1); }
```

---

### Line width *(required)*
#### `#pragma lines: width = <functionName>(<attributeList>)`
- `functionName`: name of GLSL function which returns the `float`-valued device pixel width of the line at the given vertex
- `attributeList`: comman-separated list of vertex attributes passed to the function
A fixed property which defines the width at a given vertex, measured in device pixels. If you want the width consistent across devices, it is up to you to multiply it by the regl context's `pixelRatio`.

#### Example

```glsl
#pragma lines: attribute float width
#pragma lines: width = computeWith(width)

float computeWidth(float width) { return width; }
```

---

### End cap orientation *(optional)*
#### `#pragma lines: orientation = <functionName>(<attributeList>)`
- `functionName`: name of GLSL function which returns a `float`, `reglLines.START_CAP` (`0.0`) if the cap is a start cap and `reglLines.END_CAP` (`1.0`) if an end cap.
- `attributeList`: command-separated list of vertex attributes passed to the function. Attributes consumed by a `orientation` function advance at a rate of one stride per instance.
A fixed property which defines whether a given line cap is at the beginning or end of a line.

If `orientation` is not provided, then end caps are rendered in two passes, first starting line caps, then ending line caps. If provided, then all caps are rendered in a single pass. (This complication results from the fact that there's no mechanism to distinguish the direction of end caps and get the `lineCoord` varying oriented correctly since GLSL ES 1.00 does not support `gl_InstanceID`.)

#### Example

```glsl
#pragma lines: attribute float orientation
#pragma lines: orientation = getOrientation(orientation)

float getOrientation(float orientation) { return orientation; }
```

---

### Varyings *(optional)*
#### `#pragma lines: [extrapolate] varying <type> <name> = <functionName>(<attributeList>)`
- `extrapolate`: optional keyword to indicate that the varying should be extrapolated in caps and joins. Otherwise the varying is clamped to lie within the range defined by the values at either end of the segment.
- `type`: type of varying parameter passed to fragment shader. One of `float`, `vec2`, `vec3`, vec4`.
- `name`: name of varying parameter passed to fragment shader
- `functionName`: name of GLSL function which receives the attribute values and returns the varying of the specified type
- `attributeList`: vertex attributes passed to the function

#### Example

It may make sense to extrapolate distance along the line, for example, to continue dashes on extrapolated portions of end caps and joins, while it may not make sense to extrapolate colors in such regions.

```glsl
#pragma lines: attribute vec3 color
#pragma lines: varying vec3 color = getColor(color)
vec3 getColor(vec3 color) { return color; }

#pragma lines: attribute float distance
#pragma lines: extrapolate varying float distance = getDistance(distance)
float getDistance(float distance) { return distance; }
```

---

#### Post-projection

In some cases, you may want to draw lines projected onto a surface rather than the screen. In this case, you may specify a function which receives the outgoing `vec4` `gl_Position` and returns a reprojected `vec4` position. In order to accomplish the correct width scale and aspect ratio, you may set `viewportSize` as a [draw property](#drawing-lines). This size is divided out before post-projection, leaving coordinates in clip space ([-1, 1] &times; [-1, 1] &times; [-1, 1]).
#### `#pragma lines: postproject = <functionName>`
- `functionName`: name of GLSL function which receives the screen-projected `gl_Position` vector and returns a reprojected `vec4` position.

#### Example

The following example receives the final `gl_Position` and applies one more transformation before return—in this case a camera projection-view matrix.

```glsl
#pragma lines: postproject = project
uniform mat4 projectionView;
vec4 project(vec4 position) {
  return projectionView * position;
}
```

## Fragment shader

You may define the fragment shader as you desire. The only builtin parameter is a `varying vec3` called `lineCoord`, which assists in rendering end caps and variation across the width of the line. `lineCoord.xy` lives in the square [-1, 1] &times; [-1, 1]. Starting caps lie in the left half-plane, [-1, 0] &times; [-1, 1]. The full length of the line lies along a vertical slice [0] &times; [-1, 1]. End caps lie in the right half-plane, [0, 1] &times; [-1, 1]. `lineCoord.z` is zero on line segments and is non-zero on caps and joins. This can help to render caps and joins differently, for example so that caps and joins would not entirely disappear when rendering dashed lines.

---

## Drawing lines

Drawing is invoked by passing an object with the following optional properties to the constructed draw command.

#### `drawLines({...})`

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
| `viewportSize` | `Array[number]` | `[viewportSize, viewportWidth]` | Size of screen-projection viewport |
| `vao` | `object` | null | Predefined [Vertex Array Object](#vertex-array-objects) |

#### Example

```js
// Be careful not to instantiate buffers on every draw call
const positions = [[-1, -1], [-0.5, 0.5], [0, -0.5], [0.5, 0.5], [1, -1]];
const xy = regl.buffer(positions);
const endpointXY = regl.buffer([positions.slice(0, 3), positions.slice(-3).reverse()])

drawLines({
  join: 'miter',
  vertexCount: 5,
  vertexAttributes: { xy }
  endpointCount: 2,
  endpointAttributes: { xy: endpointXY }
});
```

#### Notes
- `endpointAttributes` requires that attributes used in the computation of `orientation` be provided, but `vertexAttributes` may exclude them.
- If either `endpointAttributes` or `vertexAttributes` is excluded, the corresponding geometry will not be rendered
- You must at least provide regl buffer objects, but in the style of regl, you may either just provide a buffer, or you may provide an object of the form `{buffer, stride, offset, divisor, type}`.
- `insertCaps` automatically inserts a cap wherever a break is encountered, signaled by a position with `w = 0` or first component `NaN`. Allows drawing lines and caps with a single draw call. *Use this option with care.* To avoid wasting vertices on degenerate triangles when caps are not drawn, use `capResolution ≤ joinResolution`.

### Vertex Array Objects

Drawing lines involves repeated computation of strides and offsets on every frame. [Vertex Array Objects](https://github.com/regl-project/regl/blob/master/API.md#vertex-array-objects) (VAOs) exist to optimize this pathway. To use VAOs, simply extract `vertexAttributes` and `endpointAttributes` from render-time line data and move it to a call to `drawLines.vao()` instead. Then pass the resulting object in the draw call properties as the `vao` property. Call `vao.destroy()` to free resources.

#### `drawLines.vao({ [endpointAttributes], [vertexAttributes] })`

Allocate a Vertex Array Object for the specified draw command. The resulting object may be passed to this command via the `vao` property. 

#### Example

```
const drawLines = reglLines(...);

// Once, outside of draw loop
const vao = drawLines.vao({
  endpointAttributes: { ... },
  vertexAttributes: { ... }
});

// Within draw loop
drawLines({
  join: 'miter',
  count: n,
  vao
});

// Clean up, later
vao.destroy();
```

#### Notes

To use vertex array objects, the `OES_vertex_array_object` extension must be enabled. If it is not available, then vertex array objects will be emulated.
