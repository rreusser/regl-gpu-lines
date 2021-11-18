const fs = require('fs');
const path = require('path');
const test = require('tape');
const createContext = require('./util/create-context.js');
const createREGL = require('regl/dist/regl.js');
const createDrawLinesDev = require('../src/index.js');
const createDrawLinesProd = require('../dist/regl-gpu-lines.min.js');
const savePixels = require('save-pixels');
const getPixels = require('get-pixels');
const ndarray = require('ndarray');
const glob = require('glob');
const async = require('async');
const pixelmatch = require('pixelmatch');
const pool = require('ndarray-scratch');

const UPDATE = process.env['UPDATE'] === '1';
const CI = process.env['CI'] === '1';
const ENV = (process.env['ENV'] || '').toUpperCase() === 'PRODUCTION' ? 'production' : 'development'
const filter = process.env['FILTER'] ? new RegExp(process.env['FILTER']) : null;
const renderFixture = require('./util/render-fixture.js');

let createDrawLines;
console.log('ENV:', ENV);
if (ENV === 'production') {
  createDrawLines = createDrawLinesProd;
  console.error('Testing against production bundle dist/regl-gpu-lines.min.js');
} else {
  createDrawLines = createDrawLinesDev;
  console.error('Testing against source dir, src/');
}

const fixtureDir = path.join(__dirname, "fixtures");
const fixturePaths = glob.sync(path.join(fixtureDir, "**/fixture.json"));
const gl = createContext(256, 256);

test('run image tests', function (t) {
  for (const fixturePath of fixturePaths) {
    const relPath = path.relative(fixtureDir, fixturePath)
    if (filter && !filter.test(relPath)) continue;
    t.test(path.dirname(relPath), function (t) {
      const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

      const {width, height} = fixture;
      if (!width || !height) throw new Error(`Invalid dimensions, ${width} x ${height}`);
      gl.resize(width, height);

      const regl = createREGL({gl, extensions: ['ANGLE_instanced_arrays']});

      renderFixture(regl, createDrawLines, fixture);

      const outputName = UPDATE ? 'expected.png' : 'actual.png';
      const outputPath = path.join(path.dirname(fixturePath), outputName);
      const actualPixels = ndarray(regl.read(), [height, width, 4]).transpose(1, 0);

      regl.destroy();

      if (!CI) {
        savePixels(actualPixels.step(1, -1), 'png')
          .pipe(fs.createWriteStream(outputPath));
      }

      if (!UPDATE) {
        const expectedName = path.join(path.dirname(fixturePath), 'expected.png');

        getPixels(expectedName, function (err, unflippedExpectedPixels) {
          if (err) return t.fail(err);

          const expectedPixels = pool.clone(unflippedExpectedPixels.step(1, -1).transpose(1, 0));

          const diffData = new Uint8Array(width * height * 4);
          const badPixelCount = pixelmatch(actualPixels.data, expectedPixels.data, diffData, width, height, {
            threshold: fixture.threshold || 0.1,
            includeAA: true
          });

          if (!CI || badPixelCount) {
            const diffPath = path.join(path.dirname(fixturePath), 'diff.png');
            const diffPixels = ndarray(diffData, [height, width, 4]);
            savePixels(diffPixels.transpose(1, 0).step(1, -1), 'png')
              .pipe(fs.createWriteStream(diffPath));
          }

          const result = !badPixelCount;
          const msg = `zero unmatched pixels${badPixelCount ? ` (got ${badPixelCount} unmatched)` : ''}`;
          if (fixture.skip) {
            t.skip(result, msg);
          } else {
            t.ok(result, msg);
          }

          t.end();
        })

      } else {
        t.skip(`Wrote expected image to ${path.join(path.basename(path.dirname(fixturePath)), outputName)}`);
        regl.destroy();
        t.end();
      }
    });
  }
});
