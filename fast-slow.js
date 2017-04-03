var Base64 = require('./index.js');
var crypto = require('crypto');
var data = crypto.randomBytes(32 * 1024 * 1024);
var base64 = data.toString('base64');
var base64Buffer = Buffer.from(base64, 'ascii');
var now = 0;

console.log('');
console.log(' Decoding Base64:');
console.log('');

var times = 3;
while (times--) {
  now = Date.now();
  Buffer.from(base64, 'base64');
  console.log('    Node: Decode: ' + (Date.now() - now) + 'ms');
}

console.log('');

var times = 3;
while (times--) {
  now = Date.now();
  Base64.decode(base64Buffer);
  console.log('  Base64: Decode: ' + (Date.now() - now) + 'ms');
}

console.log('');
console.log(' Decoding Base64 (wrapped every 76 characters):');
console.log('');

function wrap(string) {
  var lines = [];
  var index = 0;
  var length = string.length;
  while (index < length) {
    lines.push(string.slice(index, index += 76));
  }
  return lines.join('\r\n');
}

base64 = wrap(base64);
base64Buffer = Buffer.from(base64, 'ascii');

var times = 3;
while (times--) {
  now = Date.now();
  Buffer.from(base64, 'base64');
  console.log('    Node: Decode: ' + (Date.now() - now) + 'ms');
}

console.log('');

var times = 3;
while (times--) {
  now = Date.now();
  Base64.decode(base64Buffer);
  console.log('  Base64: Decode: ' + (Date.now() - now) + 'ms');
}

console.log('');
