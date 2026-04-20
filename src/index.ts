export interface ConversionOptions {
  globals?: {
    Number: typeof Number;
    String: typeof String;
    TypeError: typeof TypeError;
  };
  context?: string;
  enforceRange?: boolean;
  clamp?: boolean;
  treatNullAsEmptyString?: boolean;
  allowShared?: boolean;
  allowResizable?: boolean;
}

export type Converter<T> = (value: unknown, options?: ConversionOptions) => T;

export interface Conversions {
  any: Converter<unknown>;
  undefined: Converter<undefined>;
  boolean: Converter<boolean>;
  byte: Converter<number>;
  octet: Converter<number>;
  short: Converter<number>;
  "unsigned short": Converter<number>;
  long: Converter<number>;
  "unsigned long": Converter<number>;
  "long long": Converter<number>;
  "unsigned long long": Converter<number>;
  double: Converter<number>;
  "unrestricted double": Converter<number>;
  float: Converter<number>;
  "unrestricted float": Converter<number>;
  DOMString: Converter<string>;
  ByteString: Converter<string>;
  USVString: Converter<string>;
  object: Converter<object>;
  ArrayBuffer: Converter<ArrayBuffer>;
  SharedArrayBuffer: Converter<SharedArrayBuffer>;
  DataView: Converter<DataView>;
  ArrayBufferView: Converter<ArrayBufferView>;
  BufferSource: Converter<ArrayBuffer | SharedArrayBuffer | ArrayBufferView>;
  DOMTimeStamp: Converter<number>;
  Int8Array: Converter<Int8Array>;
  Int16Array: Converter<Int16Array>;
  Int32Array: Converter<Int32Array>;
  Uint8Array: Converter<Uint8Array>;
  Uint16Array: Converter<Uint16Array>;
  Uint32Array: Converter<Uint32Array>;
  Uint8ClampedArray: Converter<Uint8ClampedArray>;
  Float32Array: Converter<Float32Array>;
  Float64Array: Converter<Float64Array>;
  [key: string]: Converter<unknown>;
}

const conversions = {} as Conversions;

function makeException(ErrorType: typeof TypeError, message: string, options: ConversionOptions): TypeError {
  if (options.globals) {
    ErrorType = options.globals[ErrorType.name as keyof typeof options.globals] as typeof TypeError;
  }
  return new ErrorType(`${options.context ? options.context : "Value"} ${message}.`);
}

function toNumber(value: unknown, options: ConversionOptions): number {
  if (typeof value === "bigint") {
    throw makeException(TypeError, "is a BigInt which cannot be converted to a number", options);
  }
  if (!options.globals) {
    return Number(value);
  }
  return options.globals.Number(value as number);
}

// Round x to the nearest integer, choosing the even integer if it lies halfway between two.
function evenRound(x: number): number {
  // There are four cases for numbers with fractional part being .5:
  //
  // case |     x     | floor(x) | round(x) | expected | x <> 0 | x % 1 | x & 1 |   example
  //   1  |  2n + 0.5 |  2n      |  2n + 1  |  2n      |   >    |  0.5  |   0   |  0.5 ->  0
  //   2  |  2n + 1.5 |  2n + 1  |  2n + 2  |  2n + 2  |   >    |  0.5  |   1   |  1.5 ->  2
  //   3  | -2n - 0.5 | -2n - 1  | -2n      | -2n      |   <    | -0.5  |   0   | -0.5 ->  0
  //   4  | -2n - 1.5 | -2n - 2  | -2n - 1  | -2n - 2  |   <    | -0.5  |   1   | -1.5 -> -2
  // (where n is a non-negative integer)
  //
  // Branch here for cases 1 and 4
  if ((x > 0 && (x % 1) === +0.5 && (x & 1) === 0) ||
        (x < 0 && (x % 1) === -0.5 && (x & 1) === 1)) {
    return censorNegativeZero(Math.floor(x));
  }

  return censorNegativeZero(Math.round(x));
}

function integerPart(n: number): number {
  return censorNegativeZero(Math.trunc(n));
}

function sign(x: number): number {
  return x < 0 ? -1 : 1;
}

function modulo(x: number, y: number): number {
  // https://tc39.github.io/ecma262/#eqn-modulo
  // Note that http://stackoverflow.com/a/4467559/3191 does NOT work for large modulos
  const signMightNotMatch = x % y;
  if (sign(y) !== sign(signMightNotMatch)) {
    return signMightNotMatch + y;
  }
  return signMightNotMatch;
}

function censorNegativeZero(x: number): number {
  return x === 0 ? 0 : x;
}

function createIntegerConversion(bitLength: number, { unsigned }: { unsigned: boolean }): Converter<number> {
  let lowerBound, upperBound;
  if (unsigned) {
    lowerBound = 0;
    upperBound = 2 ** bitLength - 1;
  } else {
    lowerBound = -(2 ** (bitLength - 1));
    upperBound = 2 ** (bitLength - 1) - 1;
  }

  const twoToTheBitLength = 2 ** bitLength;
  const twoToOneLessThanTheBitLength = 2 ** (bitLength - 1);

  return (value, options = {}) => {
    let x = toNumber(value, options);
    x = censorNegativeZero(x);

    if (options.enforceRange) {
      if (!Number.isFinite(x)) {
        throw makeException(TypeError, "is not a finite number", options);
      }

      x = integerPart(x);

      if (x < lowerBound || x > upperBound) {
        throw makeException(
          TypeError,
          `is outside the accepted range of ${lowerBound} to ${upperBound}, inclusive`,
          options
        );
      }

      return x;
    }

    if (!Number.isNaN(x) && options.clamp) {
      x = Math.min(Math.max(x, lowerBound), upperBound);
      x = evenRound(x);
      return x;
    }

    if (!Number.isFinite(x) || x === 0) {
      return 0;
    }
    x = integerPart(x);

    // Math.pow(2, 64) is not accurately representable in JavaScript, so try to avoid these per-spec operations if
    // possible. Hopefully it's an optimization for the non-64-bitLength cases too.
    if (x >= lowerBound && x <= upperBound) {
      return x;
    }

    // These will not work great for bitLength of 64, but oh well. See the README for more details.
    x = modulo(x, twoToTheBitLength);
    if (!unsigned && x >= twoToOneLessThanTheBitLength) {
      return x - twoToTheBitLength;
    }
    return x;
  };
}

function createLongLongConversion(bitLength: number, { unsigned }: { unsigned: boolean }): Converter<number> {
  const upperBound = Number.MAX_SAFE_INTEGER;
  const lowerBound = unsigned ? 0 : Number.MIN_SAFE_INTEGER;
  const asBigIntN = unsigned ? BigInt.asUintN : BigInt.asIntN;

  return (value, options = {}) => {
    let x = toNumber(value, options);
    x = censorNegativeZero(x);

    if (options.enforceRange) {
      if (!Number.isFinite(x)) {
        throw makeException(TypeError, "is not a finite number", options);
      }

      x = integerPart(x);

      if (x < lowerBound || x > upperBound) {
        throw makeException(
          TypeError,
          `is outside the accepted range of ${lowerBound} to ${upperBound}, inclusive`,
          options
        );
      }

      return x;
    }

    if (!Number.isNaN(x) && options.clamp) {
      x = Math.min(Math.max(x, lowerBound), upperBound);
      x = evenRound(x);
      return x;
    }

    if (!Number.isFinite(x) || x === 0) {
      return 0;
    }

    let xBigInt = BigInt(integerPart(x));
    xBigInt = asBigIntN(bitLength, xBigInt);
    return Number(xBigInt);
  };
}

conversions.any = value => {
  return value;
};

conversions.undefined = () => {
  return undefined;
};

conversions.boolean = value => {
  return Boolean(value);
};

conversions.byte = createIntegerConversion(8, { unsigned: false });
conversions.octet = createIntegerConversion(8, { unsigned: true });

conversions.short = createIntegerConversion(16, { unsigned: false });
conversions["unsigned short"] = createIntegerConversion(16, { unsigned: true });

conversions.long = createIntegerConversion(32, { unsigned: false });
conversions["unsigned long"] = createIntegerConversion(32, { unsigned: true });

conversions["long long"] = createLongLongConversion(64, { unsigned: false });
conversions["unsigned long long"] = createLongLongConversion(64, { unsigned: true });

conversions.double = (value, options = {}) => {
  const x = toNumber(value, options);

  if (!Number.isFinite(x)) {
    throw makeException(TypeError, "is not a finite floating-point value", options);
  }

  return x;
};

conversions["unrestricted double"] = (value, options = {}) => {
  const x = toNumber(value, options);

  return x;
};

conversions.float = (value, options = {}) => {
  const x = toNumber(value, options);

  if (!Number.isFinite(x)) {
    throw makeException(TypeError, "is not a finite floating-point value", options);
  }

  if (Object.is(x, -0)) {
    return x;
  }

  const y = Math.fround(x);

  if (!Number.isFinite(y)) {
    throw makeException(TypeError, "is outside the range of a single-precision floating-point value", options);
  }

  return y;
};

conversions["unrestricted float"] = (value, options = {}) => {
  const x = toNumber(value, options);

  if (isNaN(x)) {
    return x;
  }

  if (Object.is(x, -0)) {
    return x;
  }

  return Math.fround(x);
};

conversions.DOMString = (value, options = {}) => {
  if (options.treatNullAsEmptyString && value === null) {
    return "";
  }

  if (typeof value === "symbol") {
    throw makeException(TypeError, "is a symbol, which cannot be converted to a string", options);
  }

  const StringCtor = options.globals ? options.globals.String : String;
  return StringCtor(value as string);
};

conversions.ByteString = (value, options = {}) => {
  const x = conversions.DOMString(value, options);

  // A Unicode regexp gives identical results here, but is ~5x slower on 16-bit strings:
  // https://issues.chromium.org/issues/472892241
  // eslint-disable-next-line require-unicode-regexp
  if (/[^\x00-\xFF]/.test(x)) {
    throw makeException(TypeError, "is not a valid ByteString", options);
  }

  return x;
};

conversions.USVString = (value, options = {}) => {
  return conversions.DOMString(value, options).toWellFormed();
};

conversions.object = (value, options = {}) => {
  if (value === null || (typeof value !== "object" && typeof value !== "function")) {
    throw makeException(TypeError, "is not an object", options);
  }

  return value as object;
};

const abByteLengthGetter = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "byteLength")!.get!;
const sabByteLengthGetter = Object.getOwnPropertyDescriptor(SharedArrayBuffer.prototype, "byteLength")!.get!;

function isNonSharedArrayBuffer(value: unknown): boolean {
  try {
    abByteLengthGetter.call(value);
    return true;
  } catch {
    return false;
  }
}

function isSharedArrayBuffer(value: unknown): boolean {
  try {
    sabByteLengthGetter.call(value);
    return true;
  } catch {
    return false;
  }
}

const abResizableGetter = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "resizable")!.get!;
const sabGrowableGetter = Object.getOwnPropertyDescriptor(SharedArrayBuffer.prototype, "growable")!.get!;

function isNonSharedArrayBufferResizable(value: unknown): boolean {
  try {
    return abResizableGetter.call(value) as boolean;
  } catch {
    return false;
  }
}

function isSharedArrayBufferGrowable(value: unknown): boolean {
  try {
    return sabGrowableGetter.call(value) as boolean;
  } catch {
    return false;
  }
}

function isArrayBufferDetached(value: unknown): boolean {
  try {
    // eslint-disable-next-line no-new
    new Uint8Array(value as ArrayBuffer);
    return false;
  } catch {
    return true;
  }
}

conversions.ArrayBuffer = (value, options = {}) => {
  if (!isNonSharedArrayBuffer(value)) {
    throw makeException(TypeError, "is not an ArrayBuffer", options);
  }
  if (!options.allowResizable && isNonSharedArrayBufferResizable(value)) {
    throw makeException(TypeError, "is a resizable ArrayBuffer", options);
  }
  if (isArrayBufferDetached(value)) {
    throw makeException(TypeError, "is a detached ArrayBuffer", options);
  }

  return value as ArrayBuffer;
};

conversions.SharedArrayBuffer = (value, options = {}) => {
  if (!isSharedArrayBuffer(value)) {
    throw makeException(TypeError, "is not a SharedArrayBuffer", options);
  }
  if (!options.allowResizable && isSharedArrayBufferGrowable(value)) {
    throw makeException(TypeError, "is a growable SharedArrayBuffer", options);
  }

  return value as SharedArrayBuffer;
};

const dvByteLengthGetter =
    Object.getOwnPropertyDescriptor(DataView.prototype, "byteLength")!.get!;
conversions.DataView = (value, options = {}) => {
  try {
    dvByteLengthGetter.call(value);
  } catch {
    throw makeException(TypeError, "is not a DataView", options);
  }
  return conversions.ArrayBufferView(value, options) as DataView;
};

// Returns the unforgeable `TypedArray` constructor name or `undefined`,
// if the `this` value isn't a valid `TypedArray` object.
//
// https://tc39.es/ecma262/#sec-get-%typedarray%.prototype-@@tostringtag
const typedArrayNameGetter = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array).prototype as object,
  Symbol.toStringTag
)!.get!;
[
  Int8Array,
  Int16Array,
  Int32Array,
  Uint8Array,
  Uint16Array,
  Uint32Array,
  Uint8ClampedArray,
  Float32Array,
  Float64Array
].forEach(func => {
  const { name } = func;
  const article = /^[AEIOU]/u.test(name) ? "an" : "a";
  conversions[name] = (value, options = {}) => {
    if (!ArrayBuffer.isView(value) || typedArrayNameGetter.call(value) !== name) {
      throw makeException(TypeError, `is not ${article} ${name} object`, options);
    }
    return conversions.ArrayBufferView(value, options);
  };
});

// Common definitions

conversions.ArrayBufferView = (value, options = {}) => {
  if (!ArrayBuffer.isView(value)) {
    throw makeException(TypeError, "is not a view on an ArrayBuffer or SharedArrayBuffer", options);
  }

  if (!options.allowShared && isSharedArrayBuffer((value as ArrayBufferView).buffer)) {
    throw makeException(TypeError, "is a view on a SharedArrayBuffer, which is not allowed", options);
  }

  if (!options.allowResizable) {
    if (isNonSharedArrayBufferResizable((value as ArrayBufferView).buffer)) {
      throw makeException(TypeError, "is a view on a resizable ArrayBuffer, which is not allowed", options);
    } else if (isSharedArrayBufferGrowable((value as ArrayBufferView).buffer)) {
      throw makeException(TypeError, "is a view on a growable SharedArrayBuffer, which is not allowed", options);
    }
  }

  if (isArrayBufferDetached((value as ArrayBufferView).buffer)) {
    throw makeException(TypeError, "is a view on a detached ArrayBuffer", options);
  }
  return value as ArrayBufferView;
};

conversions.BufferSource = (value, options = {}) => {
  if (ArrayBuffer.isView(value)) {
    return conversions.ArrayBufferView(value, options);
  }

  if (isNonSharedArrayBuffer(value)) {
    return conversions.ArrayBuffer(value, options);
  } else if (options.allowShared && isSharedArrayBuffer(value)) {
    return conversions.SharedArrayBuffer(value, options);
  }

  if (options.allowShared) {
    throw makeException(TypeError, "is not an ArrayBuffer, SharedArrayBuffer, or a view on one", options);
  } else {
    throw makeException(TypeError, "is not an ArrayBuffer or a view on one", options);
  }
};

conversions.DOMTimeStamp = conversions["unsigned long long"];

export default conversions;
