'use strict';

var Base64 = {};

Base64.SILENT = 1;
Base64.WRAP = 2;

Base64.assertBinding = function(binding) {
  if (!binding) throw new Error('binding must be defined');
  if (!binding.decode) throw new Error('binding.decode must be defined');
  if (!binding.encode) throw new Error('binding.encode must be defined');
  if (typeof binding.decode != 'function') {
    throw new Error('binding.decode must be a function');
  }
  if (typeof binding.encode != 'function') {
    throw new Error('binding.encode must be a function');
  }
};

Base64.assertBoolean = function(key, value) {
  if (value !== true && value !== false) {
    throw new Error(key + ' must be a boolean');
  }
};

Base64.assertInteger = function(key, value) {
  if (typeof value !== 'number' || Math.floor(value) !== value || value < 0) {
    throw new Error(key + ' must be an integer');
  }
};

Base64.binding = {};

Base64.binding.javascript = (function() {

  var SILENT = Base64.SILENT;
  var WRAP = Base64.WRAP;

  var SPECIAL = 1 << 24;
  var ILLEGAL = 1 << 25;
  var PADDING = '='.charCodeAt(0);
  var SYMBOLS = (function() {
    var map = '';
    map += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    map += 'abcdefghijklmnopqrstuvwxyz';
    map += '0123456789+/';
    var array = new Uint8Array(map.length);
    for (var index = 0, length = map.length; index < length; index++) {
      array[index] = map.charCodeAt(index);
    }
    return array;
  })();

  var decode_table_0 = new Array(256);
  var decode_table_1 = new Array(256);
  var decode_table_2 = new Array(256);
  var decode_table_3 = new Array(256);

  function init_decode_table(table, shift) {
    // Illegal:
    for (var index = 0; index < table.length; index++) {
      table[index] = SPECIAL | ILLEGAL;
    }
    // Special:
    var special = '\t\n\r =';
    for (var index = 0, length = special.length; index < length; index++) {
      table[special.charCodeAt(index)] = SPECIAL;
    }
    // Symbols:
    for (var index = 0, length = SYMBOLS.length; index < length; index++) {
      table[SYMBOLS[index]] = index << shift;
    }
    // Standard 'base64url' with URL and Filename Safe Alphabet (RFC 4648):
    table[45] = 62 << shift; // "-"
    table[95] = 63 << shift; // "_"
    // Modified Base64 encoding for IMAP mailbox names (RFC 3501):
    table[44] = 63 << shift; // ","
  }

  init_decode_table(decode_table_0, 0 + 6 + 6 + 6);
  init_decode_table(decode_table_1, 0 + 6 + 6);
  init_decode_table(decode_table_2, 0 + 6);
  init_decode_table(decode_table_3, 0);

  var encode_table_0 = new Uint8Array(256);
  var encode_table_1 = new Uint8Array(4096);

  function init_encode_table_0() {
    for (var index = 0; index < 256; index++) {
      encode_table_0[index] = SYMBOLS[index >> 2];
    }
  }

  function init_encode_table_1() {
    for (var index = 0; index < 4096; index++) {
      encode_table_1[index] = SYMBOLS[index & 63];
    }
  }

  init_encode_table_0();
  init_encode_table_1();

  function decode(source, target, flags) {
    if (!Buffer.isBuffer(source)) {
      throw new Error('source must be a buffer');
    }
    if (!Buffer.isBuffer(target)) {
      throw new Error('target must be a buffer');
    }
    Base64.assertInteger('flags', flags);
    var targetLength = target.length;
    var sourceLength = source.length;
    if (targetLength < (Math.ceil(sourceLength / 4) * 3)) {
      throw new Error('target too small');
    }
    function step() {
      while (sourceIndex < sourceLength) {
        if (decode_table_3[source[sourceIndex]] & SPECIAL) {
          if (decode_table_3[source[sourceIndex]] & ILLEGAL) {
            if (!(flags & SILENT)) {
              throw new Error('source is corrupt');
            }
          }
          sourceIndex++;
        } else {
          temp[tempIndex++] = source[sourceIndex++];
          if (tempIndex === 4) {
            word = (
              decode_table_0[temp[0]] |
              decode_table_1[temp[1]] |
              decode_table_2[temp[2]] |
              decode_table_3[temp[3]]
            );
            target[targetIndex + 0] = (word >>> 16) & 0xFF;
            target[targetIndex + 1] = (word >>> 8) & 0xFF;
            target[targetIndex + 2] = word & 0xFF;
            targetIndex += 3;
            tempIndex = 0;
            break;
          }
        }
      }
    }
    var word = 0;
    var temp = new Array(4);
    temp[0] = 0;
    temp[1] = 0;
    temp[2] = 0;
    temp[3] = 0;
    var tempIndex = 0;
    var sourceIndex = 0;
    var targetIndex = 0;
    var sourceSubset = sourceLength - 3;
    while (sourceIndex < sourceSubset) {
      word = (
        decode_table_0[source[sourceIndex + 0]] |
        decode_table_1[source[sourceIndex + 1]] |
        decode_table_2[source[sourceIndex + 2]] |
        decode_table_3[source[sourceIndex + 3]]
      );
      if (word & SPECIAL) {
        if (word & ILLEGAL) {
          if (!(flags & SILENT)) {
            throw new Error('source is corrupt');
          }
        }
        step();
      } else {
        target[targetIndex + 0] = (word >>> 16) & 0xFF;
        target[targetIndex + 1] = (word >>> 8) & 0xFF;
        target[targetIndex + 2] = word & 0xFF;
        sourceIndex += 4;
        targetIndex += 3;
      }
    }
    step();
    if (tempIndex !== 0) {
      if (tempIndex === 1) {
        if (!(flags & SILENT)) {
          throw new Error('source is truncated');
        }
      } else if (tempIndex === 2) {
        word = (
          decode_table_0[temp[0]] |
          decode_table_1[temp[1]]
        );
        target[targetIndex + 0] = (word >>> 16) & 0xFF;
        targetIndex += 1;
      } else if (tempIndex === 3) {
        word = (
          decode_table_0[temp[0]] |
          decode_table_1[temp[1]] |
          decode_table_2[temp[2]]
        );
        target[targetIndex + 0] = (word >>> 16) & 0xFF;
        target[targetIndex + 1] = (word >>> 8) & 0xFF;
        targetIndex += 2;
      } else {
        throw new Error('tempIndex > 3');
      }
    }
    return targetIndex;
  }

  function encode(source, target, flags) {
    if (!Buffer.isBuffer(source)) {
      throw new Error('source must be a buffer');
    }
    if (!Buffer.isBuffer(target)) {
      throw new Error('target must be a buffer');
    }
    Base64.assertInteger('flags', flags);
    var sourceLength = source.length;
    var targetLength = target.length;
    if (targetLength < Base64.encodeTargetLength(sourceLength, flags)) {
      throw new Error('target too small');
    }
    var a;
    var b;
    var c;
    var line = 0;
    var targetIndex = 0;
    var sourceIndex = 0;
    var sourceSubset = Math.floor(sourceLength / 3) * 3;
    if (flags & WRAP) {
      while (sourceIndex < sourceSubset) {
        a = source[sourceIndex + 0];
        b = source[sourceIndex + 1];
        c = source[sourceIndex + 2];
        target[targetIndex + 0] = encode_table_0[a];
        target[targetIndex + 1] = encode_table_1[(a << 4) | (b >> 4)];
        target[targetIndex + 2] = encode_table_1[(b << 2) | (c >> 6)];
        target[targetIndex + 3] = encode_table_1[c];
        sourceIndex += 3;
        targetIndex += 4;
        line += 4;
        if (line === 76 && sourceIndex < sourceLength) {
          target[targetIndex + 0] = 13;
          target[targetIndex + 1] = 10;
          targetIndex += 2;
          line = 0;
        }
      }
    } else {
      while (sourceIndex < sourceSubset) {
        a = source[sourceIndex + 0];
        b = source[sourceIndex + 1];
        c = source[sourceIndex + 2];
        target[targetIndex + 0] = encode_table_0[a];
        target[targetIndex + 1] = encode_table_1[(a << 4) | (b >> 4)];
        target[targetIndex + 2] = encode_table_1[(b << 2) | (c >> 6)];
        target[targetIndex + 3] = encode_table_1[c];
        sourceIndex += 3;
        targetIndex += 4;
      }
    }
    switch (sourceLength - sourceSubset) {
      case 1:
        a = source[sourceIndex + 0];
        target[targetIndex + 0] = encode_table_0[a];
        target[targetIndex + 1] = encode_table_1[(a << 4)];
        target[targetIndex + 2] = PADDING;
        target[targetIndex + 3] = PADDING;
        targetIndex += 4;
        break;
      case 2:
        a = source[sourceIndex + 0];
        b = source[sourceIndex + 1];
        target[targetIndex + 0] = encode_table_0[a];
        target[targetIndex + 1] = encode_table_1[(a << 4) | (b >> 4)];
        target[targetIndex + 2] = encode_table_1[(b << 2)];
        target[targetIndex + 3] = PADDING;
        targetIndex += 4;
        break;
    }
    if (sourceIndex > sourceLength) {
      throw new Error('source overflow');
    }
    if (targetIndex > targetLength) {
      throw new Error('target overflow');
    }
    return targetIndex;
  }

  return {
    decode: decode,
    encode: encode
  };

})();

try {
  Base64.binding.native = require('./binding.node');
  Base64.binding.active = Base64.binding.native;
} catch (exception) {
  // We use the Javascript binding if the native binding has not been compiled.
  Base64.binding.active = Base64.binding.javascript;
}

Base64.decode = function(source, options) {
  var self = this;
  var binding = self.binding.active;
  var flags = 0;
  if (options) {
    if (options.hasOwnProperty('binding')) {
      self.assertBinding(options.binding);
      binding = options.binding;
    }
    if (options.hasOwnProperty('silent')) {
      self.assertBoolean('silent', options.silent);
      if (options.silent) flags |= self.SILENT;
    }
  }
  var target = Buffer.alloc(Math.ceil(source.length / 4) * 3);
  var targetSize = binding.decode(source, target, flags);
  if (targetSize > target.length) throw new Error('target overflow');
  return target.slice(0, targetSize);
};

Base64.encode = function(source, options) {
  var self = this;
  var binding = self.binding.active;
  var flags = 0;
  if (options) {
    if (options.hasOwnProperty('binding')) {
      self.assertBinding(options.binding);
      binding = options.binding;
    }
    if (options.hasOwnProperty('wrap')) {
      self.assertBoolean('wrap', options.wrap);
      if (options.wrap) flags |= self.WRAP;
    }
  }
  var target = Buffer.alloc(self.encodeTargetLength(source.length, flags));
  var targetSize = binding.encode(source, target, flags);
  if (targetSize > target.length) throw new Error('target overflow');
  return target.slice(0, targetSize);
};

Base64.encodeTargetLength = function(sourceLength, flags) {
  var self = this;
  self.assertInteger('sourceLength', sourceLength);
  self.assertInteger('flags', flags);
  var symbols = Math.ceil(sourceLength / 3) * 4;
  if (flags & self.WRAP) {
    var lines = Math.ceil(symbols / 76);
    var breaks = lines > 0 ? lines - 1 : 0;
    return symbols + (breaks * 2);
  } else {
    return symbols;
  }
};

module.exports = Base64;

// S.D.G.
