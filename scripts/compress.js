const fs = require('fs');
const path = require('path');
const toString = require('stream-to-string');

toString(process.stdin, function (err, str) {
  // Remove comments
  str = str.replace(/\/\/[^\\]*\\n/g, '\\n');

  // Collapse repeated line breaks
  str = str.replace(/(\\n\s*){2,}/g, '\\n');

  // Collapse space around line breaks
  str = str.replace(/(\s*\\n\s*){1,}/g, '\\n');

  // Collapse space around symbols
  str = str.replace(/\s*(=|\+|-|\*|\/|==|>|<|\(|\)|,|\?|:|\|\|)\s*/g, '$1');

  // Remove line breaks after certain symbols
  str = str.replace(/([;{}])\\n/g, '$1');

  process.stdout.write(str);
});


