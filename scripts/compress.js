const fs = require('fs');
const path = require('path');
const toString = require('stream-to-string');

toString(process.stdin, function (err, str) {

  str = str.replace(/(\\n){2,}/g, '\\n');
  str = str.replace(/(\s*\\n\s*){1,}/g, '\\n');
  str = str.replace(/\s*(=|\+|-|\*|\/|==|>|<|\(|\)|,|\?|:|\|\|)\s*/g, '$1');
  str = str.replace(/([;{}])\\n/g, '$1');

  process.stdout.write(str);
});


