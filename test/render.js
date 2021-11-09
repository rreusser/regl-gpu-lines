const fs = require('fs');
const path = require('path');
const test = require('tape');
const createContext = require('./util/create-context.js');
const createREGL = require('regl');
const createDrawLines = require('../src/index.js');
const savePixels = require('save-pixels');
const getPixels = require('get-pixels');
const ndarray = require('ndarray');
const glob = require('glob');
const async = require('async');
const pixelmatch = require('pixelmatch');
const pool = require('ndarray-scratch');

const UPDATE = process.env['UPDATE'] === '1';

function renderFixture(regl, fixture) {
  const drawLines = createDrawLines(regl, {
    ...fixture.command,
    vert: fixture.command.vert.join('\n'),
    frag: fixture.command.frag.join('\n')
  });
  regl.clear({color: [1, 1, 1, 1], depth: 1});

  const lineData = fixture.data ? {...fixture.data} : {};
  lineData.vertexAttributes = {};
  lineData.endpointAttributes = {};

  for (const [name, attribute] of Object.entries(fixture.vertexAttributes)) {
    lineData.vertexAttributes[name] = regl.buffer(attribute);
    lineData.vertexCount = attribute.length;
    lineData.endpointAttributes[name] = regl.buffer([attribute.slice(0, 3), attribute.slice(-3).reverse()])
    lineData.endpointCount = 2;
  }

  drawLines(lineData);
}

const fixtureDir = path.join(__dirname, "fixtures");
const fixturePaths = glob.sync(path.join(fixtureDir, "**/fixture.json"));
const gl = createContext(256, 256);

test('run image tests', function (t) {
  for (const fixturePath of fixturePaths) {
    t.test(path.dirname(path.relative(fixtureDir, fixturePath)), function (t) {
      const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

      const shape = fixture.shape || [256, 256];
      gl.resize(shape[0], shape[1]);

      const regl = createREGL({
        gl,
        extensions: ['ANGLE_instanced_arrays']
      });

      renderFixture(regl, fixture);

      const outputName = UPDATE ? 'expected.png' : 'actual.png';
      const outputPath = path.join(path.dirname(fixturePath), outputName);
      const actualPixels = ndarray(regl.read(), [shape[1], shape[0], 4]).transpose(1, 0);
      regl.destroy();

      savePixels(actualPixels.step(1, -1), 'png')
        .pipe(fs.createWriteStream(outputPath));

      if (!UPDATE) {
        const expectedName = path.join(path.dirname(fixturePath), 'expected.png');

        getPixels(expectedName, function (err, unflippedExpectedPixels) {
          if (err) return t.fail(err);

          const expectedPixels = pool.clone(unflippedExpectedPixels.step(1, -1).transpose(1, 0));

          const diffData = new Uint8Array(shape[0] * shape[1] * 4);
          const badPixelCount = pixelmatch(actualPixels.data, expectedPixels.data, diffData, shape[0], shape[1], {
            threshold: fixture.threshold || 0.1,
            includeAA: true
          });

          const diffPath = path.join(path.dirname(fixturePath), 'diff.png');
          const diffPixels = ndarray(diffData, [shape[1], shape[0], 4]);
          savePixels(diffPixels.transpose(1, 0).step(1, -1), 'png')
            .pipe(fs.createWriteStream(diffPath));


          t.ok(!badPixelCount, `zero unmatched pixels${badPixelCount ? ` (got ${badPixelCount})` : ''}`);

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
