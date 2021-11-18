const fs = require('fs');
const path = require('path');
const htmlIndex = require('simple-html-index');
const hyperstream = require('hyperstream');
const browserify = require('browserify');
const toString = require('stream-to-string');
const getFixtures = require('./get-fixtures.js');

toString(
  browserify().add(path.join(__dirname, 'browser-fixture-renderer.js')).bundle(),
  function (err, bundle) {
    if (err) throw new Error(err);

    htmlIndex({
      title: 'regl-gpu-lines tests'
    })
      .pipe(hyperstream({
        head: {
          _appendHtml: `
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <script src="https://unpkg.com/regl@2.1.0/dist/regl.js"></script>
          <script src="https://unpkg.com/regl-gpu-lines@latest"></script>
          `
        },
        body: {
          _appendHtml: `
<script>const fixtures = ${JSON.stringify(getFixtures())};</script>
<script>${bundle}</script>
`
        }
      }))
      .pipe(fs.createWriteStream(path.join(__dirname, '..', 'docs', 'tests.html')));
  }
);
