const fs = require('fs');
const path = require('path');
const glob = require('glob');

module.exports = getFixtures;

function getFixtures () {
  const allFixtures = {};
  const fixtureDir = path.join(__dirname, '..', 'test', 'fixtures');
  glob.sync(path.join(fixtureDir, '**', 'fixture.json'))
    .forEach(test => {
      const name = path.dirname(path.relative(fixtureDir, test));
      const testPath = path.join(fixtureDir, name, 'fixture.json');
      const fixture = fs.readFileSync(testPath, 'utf8');
      allFixtures[name] = {name, fixture};
    });
  return allFixtures;
}
