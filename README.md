# base64
Fast, robust Base64 encoder/decoder for Buffers in C++. Ignores whitespace. Detects corruption and truncation. Ships with extensive tests, a fuzz test and a benchmark.

## Motivation

Node has native Base64 methods, but these either encode a buffer and return a string (`buffer.toString('base64')`) or decode a string and return a buffer (`Buffer.from(string, 'base64')`). Node currently has no efficient way to encode a buffer as a Base64 buffer without creating an interim V8 String. Node currently has no efficient way to decode a Base64 buffer without creating an interim V8 String. This costs a few hundred megabytes per second of throughput for email servers which send and receive large email attachments. See [issue 11866](https://github.com/nodejs/node/issues/11866) for more information.

Node also silently ignores obviously corrupted or truncated Base64 data, which is conflated with whitespace or missing padding and handled by Node in the same way. While it is right that whitespace or missing padding should be ignored when decoding, illegal code points or truncated Base64 data should raise an exception to avoid data loss. See [issue 8569](https://github.com/nodejs/node/issues/8569) for more information.

## Installation

#### Linux, OS X
This will compile the native binding automatically:
```
npm install @ronomon/base64
```

#### Windows
This will skip compiling the native binding automatically:
```
npm install --ignore-scripts @ronomon/base64
```

## Performance
```
           CPU: Intel(R) Xeon(R) CPU E5-1620 v3 @ 3.50GHz
         Cores: 8
       Threads: 1

============================================================

        Encode: 8192 x 128 Bytes
    Javascript: Latency: 0.003ms Throughput: 34.95 MB/s
        Native: Latency: 0.001ms Throughput: 74.90 MB/s
          Node: Latency: 0.001ms Throughput: 87.38 MB/s

        Encode: 1024 x 1024 Bytes
    Javascript: Latency: 0.005ms Throughput: 174.76 MB/s
        Native: Latency: 0.002ms Throughput: 524.29 MB/s
          Node: Latency: 0.003ms Throughput: 262.14 MB/s

        Encode: 32 x 32768 Bytes
    Javascript: Latency: 0.055ms Throughput: 524.29 MB/s
        Native: Latency: 0.029ms Throughput: 1048.58 MB/s
          Node: Latency: 0.037ms Throughput: 1048.58 MB/s

        Encode: 10 x 1048576 Bytes
    Javascript: Latency: 1.907ms Throughput: 551.88 MB/s
        Native: Latency: 1.104ms Throughput: 953.25 MB/s
          Node: Latency: 1.554ms Throughput: 655.36 MB/s

        Encode: 10 x 4194304 Bytes
    Javascript: Latency: 7.605ms Throughput: 551.88 MB/s
        Native: Latency: 4.350ms Throughput: 953.25 MB/s
          Node: Latency: 6.420ms Throughput: 655.36 MB/s

============================================================

        Decode: 8192 x 128 Bytes
    Javascript: Latency: 0.002ms Throughput: 64.42 MB/s
        Native: Latency: 0.003ms Throughput: 52.49 MB/s
          Node: Latency: 0.001ms Throughput: 101.23 MB/s

        Decode: 1024 x 1024 Bytes
    Javascript: Latency: 0.008ms Throughput: 155.76 MB/s
        Native: Latency: 0.002ms Throughput: 467.29 MB/s
          Node: Latency: 0.003ms Throughput: 467.29 MB/s

        Decode: 32 x 32768 Bytes
    Javascript: Latency: 0.150ms Throughput: 279.64 MB/s
        Native: Latency: 0.046ms Throughput: 1398.18 MB/s
          Node: Latency: 0.094ms Throughput: 466.06 MB/s

        Decode: 10 x 1048576 Bytes
    Javascript: Latency: 4.523ms Throughput: 303.94 MB/s
        Native: Latency: 1.402ms Throughput: 998.65 MB/s
          Node: Latency: 1.986ms Throughput: 699.05 MB/s

        Decode: 10 x 4194304 Bytes
    Javascript: Latency: 18.337ms Throughput: 305.60 MB/s
        Native: Latency: 5.575ms Throughput: 998.64 MB/s
          Node: Latency: 8.018ms Throughput: 699.05 MB/s
```

## Native Binding (Optional)
The native binding will be installed automatically when installing `@ronomon/base64` without the `--ignore-scripts` argument. The Javascript binding will be used if the native binding could not be compiled or is not available. To compile the native binding manually after installing, install [node-gyp](https://www.npmjs.com/package/node-gyp) globally:
```
sudo npm install node-gyp -g
```
Then build the binding from within the `@ronomon/base64` module directory:
```
cd node_modules/@ronomon/base64
node-gyp rebuild
```

## Usage

#### Encoding
```javascript
var Base64 = require('@ronomon/base64');
var buffer = Buffer.from('Ecclesiastes 9:11-18', 'utf-8');
var bufferEncoded = Base64.encode(buffer);
console.log(bufferEncoded.toString('ascii'));
// "RWNjbGVzaWFzdGVzIDk6MTEtMTg="
```

#### Encoding 76 characters per line
```javascript
var bufferEncoded = Base64.encode(buffer, { wrap: true });
```

#### Decoding
```javascript
var Base64 = require('@ronomon/base64');
var bufferEncoded = Buffer.from('RWNjbGVzaWFzdGVzIDk6MTEtMTg=', 'ascii');
var buffer = Base64.decode(bufferEncoded);
console.log(buffer.toString('utf-8'));
// "Ecclesiastes 9:11-18"
```

#### Decoding corrupt or truncated data
Base64 will raise an exception for corrupt or truncated data by default as a defensive measure to prevent data loss and security vulnerabilities. To silence these exceptions and continue decoding in the face of bad data (not recommended), use `options.silent`:
```javascript
var Base64 = require('@ronomon/base64');
var bufferEncoded = Buffer.from('...RWNjbGVzaWFzdGVzIDk6MTEtMTg=', 'ascii');
var buffer = Base64.decode(bufferEncoded, { silent: true });
console.log(buffer.toString('utf-8'));
// "Ecclesiastes 9:11-18"
```

## Tests
To test the native and Javascript bindings:
```
node test.js
```

## Benchmark
To benchmark the native and Javascript bindings:
```
node benchmark.js
```
