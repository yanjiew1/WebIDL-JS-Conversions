import assert from "node:assert/strict";
import vm from "node:vm";

const context = vm.createContext();
const otherGlobals = {
  Number: vm.runInContext("Number", context),
  String: vm.runInContext("String", context),
  TypeError: vm.runInContext("TypeError", context)
};

export default (converter, args, exceptionType) => {
  assert.throws(() => converter(...args), exceptionType);

  const exceptionFromOtherContext = vm.runInContext(exceptionType.name, context);
  const [value, options = {}] = args;
  assert.throws(() => {
    converter(value, {
      ...options,
      globals: otherGlobals
    });
  }, exceptionFromOtherContext);
};
