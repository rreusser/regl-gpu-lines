// Source: https://github.com/regl-project/regl
//
// The MIT License (MIT)
//
// Copyright (c) 2016 Mikola Lysenko
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.
if (typeof document !== 'undefined') {
  var canvas, opts, context

  var refreshCanvas = function () {
    if (canvas) canvas.remove()

    canvas = document.createElement('canvas')
    opts = {
      antialias: false,
      stencil: true,
      preserveDrawingBuffer: true
    }
    context = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts)
    canvas.style.position = 'fixed'
    canvas.style.top = '0'
    canvas.style.right = '0'
    canvas.style.width = '256px'
    canvas.style.height = '256px'
    document.body.appendChild(canvas)
  }

  refreshCanvas()

  module.exports = function (width, height) {
    canvas.width = width
    canvas.height = height
    return context
  }

  module.exports.refreshCanvas = refreshCanvas

  module.exports.resize = function (gl, w, h) {
    canvas.width = w
    canvas.height = h
  }

  module.exports.destroy = function (gl) { }
} else {
  var CONTEXT = require('gl')(1, 1, { preserveDrawingBuffer: true })
  var RESIZE = CONTEXT.getExtension('STACKGL_resize_drawingbuffer')

  module.exports = function (w, h) {
    RESIZE.resize(w, h)
    return CONTEXT
  }

  module.exports.resize = function (gl, w, h) {
    RESIZE.resize(w, h)
  }

  module.exports.destroy = function (gl) {
  }
}
