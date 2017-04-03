var cpus = require('os').cpus();
var cpu = cpus[0].model;
var cores = cpus.length;
var concurrency = 1;

var crypto = require('crypto');
var Base64 = require('./index.js');
var Queue = require('@ronomon/queue');

var bindings = [
  {
    name: 'Javascript',
    decode: function(buffer, end) {
      var options = { binding: Base64.binding.javascript };
      Base64.decode(buffer, options);
      end();
    },
    encode: function(buffer, end) {
      var options = { binding: Base64.binding.javascript };
      Base64.encode(buffer, options);
      end();
    }
  },
  {
    name: 'Node',
    decode: function(buffer, end) {
      Buffer.from(buffer.toString('ascii'), 'base64');
      end();
    },
    encode: function(buffer, end) {
      Buffer.from(buffer.toString('base64'), 'ascii');
      end();
    }
  }
];

if (Base64.binding.native) {
  bindings.splice(1, 0, {
    name: 'Native',
    decode: function(buffer, end) {
      var options = { binding: Base64.binding.native };
      Base64.decode(buffer, options);
      end();
    },
    encode: function(buffer, end) {
      var options = { binding: Base64.binding.native };
      Base64.encode(buffer, options);
      end();
    }
  });
}

var vectors = {};
var sizes = [
  128,
  1024,
  32768,
  1 * 1024 * 1024,
  4 * 1024 * 1024
];
sizes.forEach(
  function(size) {
    var encode = [];
    var decode = [];
    var count = Math.max(10, Math.ceil(1024 * 1024 / size));
    while (count-- > 0) {
      var decoded = crypto.randomBytes(size);
      encode.push(decoded);
      // Decoder should not switch to slow-mode permanently on any white space:
      var encoded = Buffer.concat([
        Buffer.from(' ', 'ascii'),
        Base64.encode(decoded)
      ]);
      decode.push(encoded);
    }
    vectors[size] = {
      encode: encode,
      decode: decode
    };
  }
);

function benchmark(binding, method, buffers, end) {
  var now = Date.now();
  var sum = 0;
  var time = 0;
  var count = 0;
  var queue = new Queue(1);
  queue.onData = function(buffer, end) {
    var hrtime = process.hrtime();
    binding[method](buffer,
      function(error) {
        if (error) return end(error);
        var difference = process.hrtime(hrtime);
        var ns = (difference[0] * 1e9) + difference[1];
        // Count the number of data bytes that can be processed per second:
        sum += buffer.length;
        time += ns;
        count++;
        end();
      }
    );
  };
  queue.onEnd = function(error) {
    if (error) return end(error);
    var elapsed = Date.now() - now;
    var latency = (time / count) / 1000000;
    var throughput = sum / elapsed / 1000;
    display([
      binding.name + ':',
      'Latency:',
      latency.toFixed(3) + 'ms',
      'Throughput:',
      throughput.toFixed(2) + ' MB/s'
    ]);
    end();
  };
  queue.concat(buffers);
  queue.end();
}

function display(columns) {
  var string = columns[0];
  while (string.length < 15) string = ' ' + string;
  string += ' ' + columns.slice(1).join(' ');
  console.log(string);
}

console.log('');
display([ 'CPU:', cpu ]);
display([ 'Cores:', cores ]);
display([ 'Threads:', concurrency ]);

var queue = new Queue();
queue.onData = function(method, end) {
  console.log('');
  console.log('============================================================');
  var queue = new Queue();
  queue.onData = function(size, end) {
    var buffers = vectors[size][method];
    console.log('');
    display([
      method.slice(0, 1).toUpperCase() + method.slice(1) + ':',
      buffers.length + ' x ' + size + ' Bytes'
    ]);
    var queue = new Queue();
    queue.onData = function(binding, end) {
      benchmark(binding, method, buffers, end);
    };
    queue.onEnd = end;
    queue.concat(bindings);
    queue.end();
  };
  queue.onEnd = end;
  queue.concat(sizes);
  queue.end();
};
queue.onEnd = function(error) {
  if (error) throw error;
  console.log('');
};
queue.push('encode');
queue.push('decode');
queue.end();
