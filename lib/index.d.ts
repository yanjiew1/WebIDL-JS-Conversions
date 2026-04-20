type GlobalsLike = {
    Number?: NumberConstructor;
    String?: StringConstructor;
    TypeError?: typeof TypeError;
    [key: string]: unknown;
};
interface ConversionOptions {
    context?: string;
    globals?: GlobalsLike;
}
interface IntegerConversionOptions extends ConversionOptions {
    clamp?: boolean;
    enforceRange?: boolean;
}
interface FloatingPointOptions extends ConversionOptions {
}
interface StringConversionOptions extends ConversionOptions {
    treatNullAsEmptyString?: boolean;
}
interface ArrayBufferOptions extends ConversionOptions {
    allowResizable?: boolean;
}
interface ArrayBufferViewOptions extends ConversionOptions {
    allowShared?: boolean;
    allowResizable?: boolean;
}
type BufferSourceOptions = ArrayBufferViewOptions;
type ConversionFunction<O extends ConversionOptions = ConversionOptions, R = unknown> = (value: unknown, options?: O) => R;
type BufferViewConversion = ConversionFunction<ArrayBufferViewOptions, ArrayBufferView>;
type ArrayBufferConversion = ConversionFunction<ArrayBufferOptions, ArrayBuffer>;
type SharedArrayBufferConversion = ConversionFunction<ArrayBufferOptions, SharedArrayBuffer>;
type TypedArrayConstructors = typeof Int8Array | typeof Int16Array | typeof Int32Array | typeof Uint8Array | typeof Uint16Array | typeof Uint32Array | typeof Uint8ClampedArray | typeof Float32Array | typeof Float64Array;
type TypedArrayNames = TypedArrayConstructors["name"];
type Conversions = Record<string, ConversionFunction> & {
    any: ConversionFunction<ConversionOptions, unknown>;
    undefined: () => undefined;
    boolean: ConversionFunction<ConversionOptions, boolean>;
    byte: ConversionFunction<IntegerConversionOptions, number>;
    octet: ConversionFunction<IntegerConversionOptions, number>;
    short: ConversionFunction<IntegerConversionOptions, number>;
    "unsigned short": ConversionFunction<IntegerConversionOptions, number>;
    long: ConversionFunction<IntegerConversionOptions, number>;
    "unsigned long": ConversionFunction<IntegerConversionOptions, number>;
    "long long": ConversionFunction<IntegerConversionOptions, number>;
    "unsigned long long": ConversionFunction<IntegerConversionOptions, number>;
    double: ConversionFunction<FloatingPointOptions, number>;
    "unrestricted double": ConversionFunction<FloatingPointOptions, number>;
    float: ConversionFunction<FloatingPointOptions, number>;
    "unrestricted float": ConversionFunction<FloatingPointOptions, number>;
    DOMString: ConversionFunction<StringConversionOptions, string>;
    ByteString: ConversionFunction<StringConversionOptions, string>;
    USVString: ConversionFunction<StringConversionOptions, string>;
    object: ConversionFunction<ConversionOptions, object>;
    ArrayBuffer: ArrayBufferConversion;
    SharedArrayBuffer: SharedArrayBufferConversion;
    DataView: ConversionFunction<ArrayBufferViewOptions, DataView>;
    ArrayBufferView: BufferViewConversion;
    BufferSource: ConversionFunction<BufferSourceOptions, ArrayBuffer | SharedArrayBuffer | ArrayBufferView>;
    DOMTimeStamp: ConversionFunction<IntegerConversionOptions, number>;
} & {
    [K in TypedArrayNames]: BufferViewConversion;
};
declare const conversions: Conversions;
export default conversions;
