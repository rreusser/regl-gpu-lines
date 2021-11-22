## 2.2.1

### Bugfixes

- Try hot-fixing an issue with VAO setup.

## 2.2.0

### Features

- Adds support for Vertex Array Objects (VAOs). To use, move `vertexAttributes` and `endpointAttributes` out of per-frame draw call properties to the `drawLines.vao({vertexAttributes, endpointAttributes})` constructor, then pass the resulting object to the draw call as the `vao` property.

## 2.1.0

### Features

- Adds `postproject` pragma to apply an additional transformation to lines after screen-projection.
- Adds `viewportSize` render-time option in case you wish to project lines to some other shape than the viewport size. May be used in conjunction with `postproject`, for example to render to the unit square and then view that square from some other angle.

## 2.0.0

### Features

- Moves `insertCaps` from a compile-time to a runtime configuration option.
- Lazily instantiates the four potential draw command variations (endpoints vs. interior segments, and insert caps true vs. false).
- Adds `reorder` as a compile-time option. When true (default: true), it internally reorders draw calls for arrays of line props (`drawLines([{...}, {...}, ...])`) to avoid repeatedly changing the shader program.

## 1.1.0

### Features

- Reenable NaN to signal line breaks. It seems to work now. [Confirm here](https://rreusser.github.io/regl-gpu-lines/docs/tests.html#miter/insert-caps/nan).

## 1.0.0

This release has no new features. Flipping the switch since, for the first time since starting, I don't have major new features or blocking bugs which would prevent me from calling this a piece of usable software. :tada:

## 0.0.23

### Features

- Turning an integer index into a position was somewhat badly done. This release completely renumbers all of the indices. Instead of modifying geometry and flipping it in order to get winding order correct, it now shifts vertex indices by one while preserving geometry. At the cost of one extra wasted vertex, this has the effect of flipping winding order when needed in order to make it consistent--but without modifying geometry. The resulting code is easier to follow, shorter, cleaner, and shows better results.

### Bugfixes

- As a result of renumbering, winding order is now consistent.
- Collapsed triangle vertices are now repeated at the first and last points only, rather than scattered throughout the instances.

## 0.0.22

### Features

- A new live-reloading test page with `npm run serve-render-tests`, accessible online using published module at https://rreusser.github.io/regl-gpu-lines/docs/tests.html

### Bugfixes

- Fixes badly broken behavior on devices which don't successfully check for NaN in the shader

## 0.0.21

### Features

- Clean up one of the worst parts of the shader code and get end cap insertion working with all combinations of joins and caps. :tada:

## 0.0.20

### Features

- Add optional `extrapolate` keyword, as in `#pragma lines: extrapolate varying float name` to distinguish between varyings which are extrapolated outside the bounds of their respective segment endpoint values, and varyings which are clamped to the range of the segment. This can be used to dash caps and joins or to ensure colors are not extrapolated.

## 0.0.19

### Features

- Add `insertCaps` option to be explicit about when caps are automatically inserted

### Bugfixes

- Switch to preferring `w = 0` instead of `NaN` since `NaN` detection is a bit unreliable in GLSL.

## 0.0.18

### Features

- Now inserts caps when it encounters NaN. With some remaining API cleanup since miters and bevels don't have enough points per instance to build a proper round.

### Bugfixes

- Resolve hairpin and collinear cases!! :tada:

## 0.0.17

### Bugfixes

- Fix debug instance ID

## 0.0.16

### Features

- Almost a complete rewrite. Consolidated everything into a single shader with two switches (round vs. miter, cap vs. interior).
- Line dashes work with both round and miter
- SDF borders now work with round and miter
- Bundle size down to 11kB minified, 4.5kB gzipped

### Limitations

- Degenerate lines which turn 180 degrees are a regression. They sometimes but not always work. A tiny floating point offset will fix things.

## 0.0.15

### Features

- Completely reworked rounded join geometry to split joins down the middle. This makes dashes usable, currently only with rounded joins.
- Improved handling of z-coordinate
- Improved handling of some corner cases, including self-intersecting lines and short segments
- Added tests

## 0.0.14

### Features

- Convert the index attribute into a unit-grid-aligned coordinate for wireframes. This is equivalent but much easier than exploding the triangle strip geometry into individual triangles.

### Bugfixes 

- Republish after botched 0.0.13 publish

## 0.0.12

### Bufixes

- Fix an issue in which varying parameters were not triggering inclusion of their respective attributes.
- Fix custom attribute divisor not set correctly

### Features

- Debugged interleaved attributes. They work great! :tada:
 
## 0.0.11

### Features

- Rename `isstart` to `capOrientation` and change from a boolean to a float. `isstart` seemed unpleasantly asymmetric.  `CAP_START` and `CAP_END` are now exported as constants on the `reglLines` function. In the future this may be used as a bit mask to additionally allow signaling two-vertex lines.
 
### Bugfixes

- Throw errors when attempting to forward `count`, `elements`, `attributes` or `instances` to regl.

## 0.0.10

### Bugfixes

- Fix inner miters to clip to the lesser of the two adjacent segment lengths

## 0.0.9

### Bugfixes

- Remove the minimum-length constraint (was 1/100 pixel) since it sometimes results in missing caps.
- Improved documentation!

## 0.0.8

### Bugfixes

- Fix an issue with using nan or w=0 to split lines into multiple segments

## 0.0.7

Beginning a changelog as the module is starting to stabilize. :tada:

### Features

- It's proving extremely common to implement a regl wrapper with customization that falls outside the scope of this module. This release adds the ability to merge that config with the arguments to this module. It now uses the `vert`, `frag`, and `debug` options and forward all other configuration to a regl wrapper, invoked on each draw.


