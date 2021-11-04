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


