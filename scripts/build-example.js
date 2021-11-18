const fs = require('fs');
const path = require('path');
const hyperstream = require('hyperstream');

const entry = process.argv[2];
const output = path.join(__dirname, '..', 'docs', path.basename(entry, '.js') + '.html');

const htmlStream = fs.createReadStream(path.join(__dirname, '_example.html'));
const content = fs.readFileSync(path.join(__dirname, '..', entry), 'utf8');
const outStream = fs.createWriteStream(output);

htmlStream
  .pipe(hyperstream({
    body: {
      _appendHtml: `\n<script>
${content}
</script>
<style>
#code-container {
  font-family: sans-serif;
  position: absolute;
  left: 0;
  z-index: 10;
  max-height: 90%;
  overflow: auto;
  background-color: white;
}
#code-container summary {
  padding: 15px;
  cursor: pointer;
}
</style>
<div id="code-container">
<details>
<summary>Code</summary>
<pre><code id="code">
${content}
</code></pre>
</details>
</div>
<script>
const code = document.getElementById('code');
hljs.highlightElement(code);
</script>
`
    }
  }))
  .pipe(outStream);
