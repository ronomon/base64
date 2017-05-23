var Node = { crypto: require('crypto') };

var Test = {};

Test.equal = function(value, expected, namespace, description) {
  value = JSON.stringify(value) + '';
  expected = JSON.stringify(expected) + '';
  if (value === expected) {
    Test.pass(namespace, description, expected);
  } else {
    Test.fail(namespace, description, value + ' !== ' + expected);
  }
};

Test.fail = function(namespace, description, message) {
  console.log('');
  throw 'FAIL: ' + Test.message(namespace, description, message);
};

Test.message = function(namespace, description, message) {
  if ((namespace = namespace || '')) namespace += ': ';
  if ((description = description || '')) description += ': ';
  return namespace + description + (message || '');
};

Test.pass = function(namespace, description, message) {
  console.log('PASS: ' + Test.message(namespace, description, message));
};

var RNG = function(seed) {
  var self = this;
  if (seed === undefined) seed = Date.now();
  if (typeof seed !== 'number' || Math.round(seed) !== seed || seed < 0) {
    throw new Error('bad seed');
  }
  self.seed = seed % Math.pow(2, 31);
  self.hash = self.seed;
};

RNG.prototype.random = function() {
  var self = this;
  self.hash = ((self.hash + 0x7ED55D16) + (self.hash << 12)) & 0xFFFFFFF;
  self.hash = ((self.hash ^ 0xC761C23C) ^ (self.hash >>> 19)) & 0xFFFFFFF;
  self.hash = ((self.hash + 0x165667B1) + (self.hash << 5)) & 0xFFFFFFF;
  self.hash = ((self.hash + 0xD3A2646C) ^ (self.hash << 9)) & 0xFFFFFFF;
  self.hash = ((self.hash + 0xFD7046C5) + (self.hash << 3)) & 0xFFFFFFF;
  self.hash = ((self.hash ^ 0xB55A4F09) ^ (self.hash >>> 16)) & 0xFFFFFFF;
  return (self.hash & 0xFFFFFFF) / 0x10000000;
};

var rng = new RNG(1);
var random = rng.random.bind(rng);

var namespace = 'Base64';

var WHITESPACE = '\t\n\r ';

var VALID = (function() {
  var array = new Uint8Array(256);
  var map1 = '';
  map1 += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  map1 += 'abcdefghijklmnopqrstuvwxyz';
  map1 += '0123456789+/';
  map1 += '-_,';
  for (var index = 0, length = map1.length; index < length; index++) {
    array[map1.charCodeAt(index)] = 1;
  }
  var map2 = '\t\n\r =';
  for (var index = 0, length = map2.length; index < length; index++) {
    array[map2.charCodeAt(index)] = 2;
  }
  return array;
})();


function assertValidEncoding(buffer) {
  for (var index = 0, length = buffer.length; index < length; index++) {
    if (!VALID[buffer[index]]) {
      throw new Error(buffer[index] + ' is not a valid symbol or whitespace.');
    }
  }
}

function generateBuffer() {
  var bins = [
    8,
    32,
    1024,
    65536
  ];
  var bin = bins[Math.floor(random() * bins.length)];
  var length = Math.ceil(random() * bin);
  var buffer = Buffer.alloc(length);
  while (length--) buffer[length] = Math.floor(random() * 256);
  return buffer;
}

function generateWhitespace() {
  var length = Math.ceil(random() * 1);
  var buffer = Buffer.alloc(length);
  while (length--) {
    buffer[length] = WHITESPACE.charCodeAt(
      Math.floor(random() * WHITESPACE.length)
    );
  }
  return buffer;
}

function hash(buffer) {
  var hash = Node.crypto.createHash('SHA256');
  hash.update(buffer);
  return hash.digest('hex').slice(0, 32);
}

function withCorruption(buffer) {
  if (buffer.length === 0) return undefined;
  var corrupt = Buffer.from(buffer);
  var count = Math.min(
    Math.max(1, Math.ceil(random() * 100)),
    buffer.length
  );
  while (count-- > 0) {
    var index = Math.floor(random() * buffer.length);
    while (VALID[corrupt[index]]) {
      corrupt[index] = Math.floor(random() * 256);
    }
  }
  return corrupt;
}

function withTransportPadding(buffer) {
  var buffers = [];
  var index = 0;
  var length = buffer.length;
  if (buffer[length - 1] === 61 && random() < 0.5) {
    length--;
    if (buffer[length - 1] === 61 && random() < 0.5) {
      length--;
    }
  }
  while (index < length) {
    var size = Math.round(random() * (length - index));
    if (random() < 0.1) buffers.push(generateWhitespace());
    buffers.push(buffer.slice(index, index += size));
    if (random() < 0.1) buffers.push(generateWhitespace());
  }
  function extraPadding() {
    var length = Math.round(random() * 7);
    var buffer = Buffer.alloc(length);
    while (length-- > 0) buffer[length] = '='.charCodeAt(0);
    return buffer;
  }
  if (random() < 0.2) buffers.push(extraPadding());
  return Buffer.concat(buffers);
}

function withTruncation(buffer) {
  if (buffer.length === 0) return undefined;
  var truncated = Buffer.from(buffer);
  var symbols = 0;
  // Count the actual data symbols (as opposed to whitespace or padding):
  for (var index = 0, length = truncated.length; index < length; index++) {
    if (VALID[truncated[index]] === 1) symbols++;
  }
  // How many symbols are in the last quartet?
  var last = symbols % 4;
  if (last === 0) {
    if (symbols === 0) return undefined;
    var remove = 3;
  } else if (last === 2) {
    var remove = 1;
  } else if (last === 3) {
    var remove = 2;
  } else {
    throw new Error('Last quartet has unexpected number of symbols: ' + last);
  }
  var length = truncated.length;
  while (length-- > 0 && remove > 0) {
    if (VALID[truncated[length]] === 1) {
      truncated[length] = 32; // Replace symbol with a space.
      remove--;
    }
  }
  if (remove > 0) throw new Error('Failed to remove enough symbols.');
  return truncated;
}

function Encode(buffer, options) {
  var base64 = Buffer.from(buffer.toString('base64'), 'ascii');
  if (options.wrap) {
    var buffers = [];
    var index = 0;
    var length = base64.length;
    while (index < length) {
      buffers.push(base64.slice(index, index += 76));
      buffers.push(Buffer.from('\r\n', 'ascii'));
    }
    base64 = Buffer.concat(buffers);
    base64 = Buffer.from(base64.toString('ascii').trim(), 'ascii');
  }
  return base64;
}

var sources = [];
var length = 1000;
while (length--) sources.push(generateBuffer());

var Base64 = require('./index.js');
var bindingNames = [
  'javascript'
];
if (Base64.binding.native) bindingNames.push('native');

var empty = Buffer.alloc(0);
var exceptions = {
  decode: [
    {
      args: [[], empty, 0],
      error: 'source must be a buffer'
    },
    {
      args: [empty, [], 0],
      error: 'target must be a buffer'
    },
    {
      args: [
        Buffer.alloc(4),
        Buffer.alloc(3 - 1),
        0
      ],
      error: 'target too small'
    },
    {
      args: [empty, empty, '0'],
      error: 'flags must be an integer'
    },
    {
      args: [empty, empty, -1],
      error: 'flags must be an integer'
    },
    {
      args: [empty, empty, 1.5],
      error: 'flags must be an integer'
    }
  ],
  encode: [
    {
      args: [[], empty, 0],
      error: 'source must be a buffer'
    },
    {
      args: [empty, [], 0],
      error: 'target must be a buffer'
    },
    {
      args: [
        Buffer.alloc(3),
        Buffer.alloc(4 - 1),
        0
      ],
      error: 'target too small'
    },
    {
      args: [empty, empty, '0'],
      error: 'flags must be an integer'
    },
    {
      args: [empty, empty, -1],
      error: 'flags must be an integer'
    },
    {
      args: [empty, empty, 1.5],
      error: 'flags must be an integer'
    }
  ]
};

bindingNames.forEach(
  function(bindingName) {
    var binding = Base64.binding[bindingName];
    Test.equal(bindingName, bindingName, namespace, 'binding');
    Object.keys(exceptions).forEach(
      function(method) {
        exceptions[method].forEach(
          function(test) {
            try {
              binding[method].apply(binding, test.args);
              Test.equal('', test.error, namespace, method + ' exception');
            } catch (error) {
              Test.equal(
                error.message,
                test.error,
                namespace,
                method + ' exception'
              );
            }
          }
        );
      }
    );
    sources.forEach(
      function(source) {
        try {
          Test.equal(bindingName, bindingName, namespace, 'binding');
          var options = { binding: binding };
          if (random() < 0.8) {
            options.wrap = random() < 0.5;
          }
          Test.equal(options.wrap, options.wrap, namespace, 'options.wrap');
          Test.equal(source.length, source.length, namespace, 'source.length');
          var sourceHash = hash(source);
          var encoding = Base64.encode(source, options);
          Test.equal(
            hash(encoding),
            hash(Encode(source, options)),
            namespace,
            'standard implementation'
          );
          Test.equal(
            hash(source) === sourceHash,
            true,
            namespace,
            'source unchanged by encode()'
          );
          var encodingHash = hash(encoding);
          Test.equal(
            encoding.length,
            encoding.length,
            namespace,
            'encoding.length'
          );
          Test.equal(
            assertValidEncoding(encoding) === undefined,
            true,
            namespace,
            'valid encoding'
          );
          if (hash(encoding) !== encodingHash) {
            Test.equal(
              hash(encoding) === encodingHash,
              true,
              namespace,
              'encoding unchanged by assertValidEncoding()'
            );
          }
          var decoding = Base64.decode(encoding, options);
          Test.equal(
            hash(encoding) === encodingHash,
            true,
            namespace,
            'encoding unchanged by decode()'
          );
          Test.equal(
            decoding.length,
            source.length,
            namespace,
            'decoding.length'
          );
          Test.equal(hash(decoding), sourceHash, namespace, 'decoding');
          var encodingPadding = withTransportPadding(encoding);
          if (hash(encoding) !== encodingHash) {
            Test.equal(
              hash(encoding) === encodingHash,
              true,
              namespace,
              'encoding unchanged by withTransportPadding()'
            );
          }
          Test.equal(
            encodingPadding.length,
            encodingPadding.length,
            namespace,
            'encodingPadding.length'
          );
          var decodingPadding = Base64.decode(encodingPadding, options);
          Test.equal(
            decodingPadding.length,
            source.length,
            namespace,
            'decodingPadding.length'
          );
          Test.equal(
            hash(decodingPadding),
            sourceHash,
            namespace,
            'decodingPadding'
          );
          var corrupt = withCorruption(encodingPadding);
          if (corrupt) {
            var corruptException;
            try {
              Base64.decode(corrupt, options);
            } catch (exception) {
              corruptException = exception.message;
            }
            Test.equal(
              corruptException,
              'source is corrupt',
              namespace,
              'corrupt exception'
            );
          }
          var truncated = withTruncation(encodingPadding);
          if (truncated) {
            var truncatedException;
            try {
              Base64.decode(truncated, options);
            } catch (exception) {
              truncatedException = exception.message;
            }
            Test.equal(
              truncatedException,
              'source is truncated',
              namespace,
              'truncated exception'
            );
          }
        } catch (error) {
          if (source) {
            console.log(
              '  Source: ' + JSON.stringify(source.toString('binary'))
            );
          }
          if (decoding) {
            console.log('');
            console.log(
              'Decoding: ' + JSON.stringify(decoding.toString('binary'))
            );
          }
          if (decodingPadding) {
            console.log('');
            console.log(
              'DPadding: ' + JSON.stringify(decodingPadding.toString('binary'))
            );
          }
          if (encoding) {
            console.log('');
            console.log(
              'Encoding: ' + JSON.stringify(encoding.toString('binary'))
            );
          }
          if (encodingPadding) {
            console.log('');
            console.log(
              'EPadding: ' + JSON.stringify(encodingPadding.toString('binary'))
            );
          }
          throw error;
        }
      }
    );
  }
);
console.log('Bindings Tested: ' + bindingNames.join(', '));
console.log('================');
console.log('PASSED ALL TESTS');
console.log('================');
