#include <nan.h>
#include <stdint.h>

uint32_t ceil_div(uint32_t x, uint32_t y) {
  return (x % y) ? ((x / y) + 1) : (x / y);
}

const uint8_t SILENT = 1;
const uint8_t WRAP = 2;

const uint32_t SPECIAL = 1 << 24;
const uint32_t ILLEGAL = 1 << 25;
const uint8_t PADDING = 61; // "=";
const unsigned char SYMBOLS[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
                                "abcdefghijklmnopqrstuvwxyz"
                                "0123456789+/";

uint32_t decode_table_0[256];
uint32_t decode_table_1[256];
uint32_t decode_table_2[256];
uint32_t decode_table_3[256];

void init_decode_table(uint32_t table[], const int shift) {
  // Illegal:
  for (int index = 0; index < 256; index++) {
    table[index] = SPECIAL | ILLEGAL;
  }
  // Special:
  static const unsigned char special[] = "\t\n\r =";
  for (int index = 0; index < 5; index++) {
    table[special[index]] = SPECIAL;
  }
  // Symbols:
  for (int index = 0; index < 64; index++) {
    table[SYMBOLS[index]] = index << shift;
  }
  // Standard 'base64url' with URL and Filename Safe Alphabet (RFC 4648):
  table[45] = 62 << shift; // "-"
  table[95] = 63 << shift; // "_"
  // Modified Base64 encoding for IMAP mailbox names (RFC 3501):
  table[44] = 63 << shift; // ","
}

uint8_t encode_table_0[256];
uint8_t encode_table_1[4096];

void init_encode_table_0() {
  for (int index = 0; index < 256; index++) {
    encode_table_0[index] = SYMBOLS[index >> 2];
  }
}

void init_encode_table_1() {
  for (int index = 0; index < 4096; index++) {
    encode_table_1[index] = SYMBOLS[index & 63];
  }
}

int decode_step(
  const uint32_t flags,
  const uint8_t* source,
  uint8_t* target,
  const uint32_t sourceLength,
  uint32_t &sourceIndex,
  uint32_t &targetIndex,
  uint8_t temp[],
  uint8_t &tempIndex
) {
  while (sourceIndex < sourceLength) {
    if (decode_table_3[source[sourceIndex]] & SPECIAL) {
      if (decode_table_3[source[sourceIndex]] & ILLEGAL) {
        if (!(flags & SILENT)) {
          return 0;
        }
      }
      sourceIndex++;
    } else {
      temp[tempIndex++] = source[sourceIndex++];
      if (tempIndex == 4) {
        const uint32_t word = (
          decode_table_0[temp[0]] |
          decode_table_1[temp[1]] |
          decode_table_2[temp[2]] |
          decode_table_3[temp[3]]
        );
        target[targetIndex + 0] = (word >> 16) & 0xFF;
        target[targetIndex + 1] = (word >> 8) & 0xFF;
        target[targetIndex + 2] = word & 0xFF;
        targetIndex += 3;
        tempIndex = 0;
        break;
      }
    }
  }
  return 1;
}

uint32_t encodeTargetLength(const uint32_t sourceLength, const uint32_t flags) {
  uint32_t symbols = ceil_div(sourceLength, 3) * 4;
  if (flags & WRAP) {
    uint32_t lines = ceil_div(symbols, 76);
    uint32_t breaks = lines > 0 ? lines - 1 : 0;
    return symbols + (breaks * 2);
  } else {
    return symbols;
  }
}

NAN_METHOD(decode) {
  if (info.Length() != 3) {
    return Nan::ThrowError("bad number of arguments");
  }
  if (!node::Buffer::HasInstance(info[0])) {
    return Nan::ThrowError("source must be a buffer");
  }
  if (!node::Buffer::HasInstance(info[1])) {
    return Nan::ThrowError("target must be a buffer");
  }
  if (!info[2]->IsUint32()) {
    return Nan::ThrowError("flags must be an integer");
  }
  v8::Local<v8::Object> sourceHandle = info[0].As<v8::Object>();
  v8::Local<v8::Object> targetHandle = info[1].As<v8::Object>();
  const uint32_t flags = info[2]->Uint32Value();
  const uint32_t sourceLength = node::Buffer::Length(sourceHandle);
  const uint32_t targetLength = node::Buffer::Length(targetHandle);
  if (targetLength < (ceil_div(sourceLength, 4) * 3)) {
    return Nan::ThrowError("target too small");
  }
  const uint8_t* source = reinterpret_cast<const uint8_t*>(
    node::Buffer::Data(sourceHandle)
  );
  uint8_t* target = reinterpret_cast<uint8_t*>(
    node::Buffer::Data(targetHandle)
  );
  uint8_t temp[4];
  uint8_t tempIndex = 0;
  uint32_t sourceIndex = 0;
  uint32_t targetIndex = 0;
  uint32_t sourceSubset = sourceLength >= 3 ? sourceLength - 3 : 0;
  while (sourceIndex < sourceSubset) {
    const uint32_t word = (
      decode_table_0[source[sourceIndex + 0]] |
      decode_table_1[source[sourceIndex + 1]] |
      decode_table_2[source[sourceIndex + 2]] |
      decode_table_3[source[sourceIndex + 3]]
    );
    if (word & SPECIAL) {
      if (
        !decode_step(
          flags,
          source,
          target,
          sourceLength,
          sourceIndex,
          targetIndex,
          temp,
          tempIndex
        )
      ) {
        return Nan::ThrowError("source is corrupt");
      }
    } else {
      target[targetIndex + 0] = (word >> 16) & 0xFF;
      target[targetIndex + 1] = (word >> 8) & 0xFF;
      target[targetIndex + 2] = word & 0xFF;
      sourceIndex += 4;
      targetIndex += 3;
    }
  }
  if (
    !decode_step(
      flags,
      source,
      target,
      sourceLength,
      sourceIndex,
      targetIndex,
      temp,
      tempIndex
    )
  ) {
    return Nan::ThrowError("source is corrupt");
  }
  if (tempIndex != 0) {
    if (tempIndex == 1) {
      if (!(flags & SILENT)) {
        return Nan::ThrowError("source is truncated");
      }
    } else if (tempIndex == 2) {
      const uint32_t word = (
        decode_table_0[temp[0]] |
        decode_table_1[temp[1]]
      );
      target[targetIndex + 0] = (word >> 16) & 0xFF;
      targetIndex += 1;
    } else if (tempIndex == 3) {
      const uint32_t word = (
        decode_table_0[temp[0]] |
        decode_table_1[temp[1]] |
        decode_table_2[temp[2]]
      );
      target[targetIndex + 0] = (word >> 16) & 0xFF;
      target[targetIndex + 1] = (word >> 8) & 0xFF;
      targetIndex += 2;
    } else {
      return Nan::ThrowError("tempIndex > 3");
    }
  }
  if (sourceIndex > sourceLength) {
    return Nan::ThrowError("source overflow");
  }
  if (targetIndex > targetLength) {
    return Nan::ThrowError("target overflow");
  }
  info.GetReturnValue().Set(targetIndex);
}

NAN_METHOD(encode) {
  if (info.Length() != 3) {
    return Nan::ThrowError("bad number of arguments");
  }
  if (!node::Buffer::HasInstance(info[0])) {
    return Nan::ThrowError("source must be a buffer");
  }
  if (!node::Buffer::HasInstance(info[1])) {
    return Nan::ThrowError("target must be a buffer");
  }
  if (!info[2]->IsUint32()) {
    return Nan::ThrowError("flags must be an integer");
  }
  v8::Local<v8::Object> sourceHandle = info[0].As<v8::Object>();
  v8::Local<v8::Object> targetHandle = info[1].As<v8::Object>();
  const uint32_t flags = info[2]->Uint32Value();
  const uint32_t sourceLength = node::Buffer::Length(sourceHandle);
  const uint32_t targetLength = node::Buffer::Length(targetHandle);
  if (targetLength < encodeTargetLength(sourceLength, flags)) {
    return Nan::ThrowError("target too small");
  }
  const uint8_t* source = reinterpret_cast<const uint8_t*>(
    node::Buffer::Data(sourceHandle)
  );
  uint8_t* target = reinterpret_cast<uint8_t*>(
    node::Buffer::Data(targetHandle)
  );
  uint8_t a;
  uint8_t b;
  uint8_t c;
  uint8_t line = 0;
  uint32_t sourceIndex = 0;
  uint32_t targetIndex = 0;
  uint32_t sourceSubset = (sourceLength / 3) * 3;
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
      if (line == 76 && sourceIndex < sourceLength) {
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
    return Nan::ThrowError("source overflow");
  }
  if (targetIndex > targetLength) {
    return Nan::ThrowError("target overflow");
  }
  info.GetReturnValue().Set(targetIndex);
}

NAN_MODULE_INIT(Init) {
  init_decode_table(decode_table_0, 0 + 6 + 6 + 6);
  init_decode_table(decode_table_1, 0 + 6 + 6);
  init_decode_table(decode_table_2, 0 + 6);
  init_decode_table(decode_table_3, 0);
  init_encode_table_0();
  init_encode_table_1();
  NAN_EXPORT(target, decode);
  NAN_EXPORT(target, encode);
}

NODE_MODULE(binding, Init)

// S.D.G.
