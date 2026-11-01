// jest-expo's native environment, with a workaround for Jest 30 on Node 26.
//
// Jest 30 creates the test context from a Proxy so it can track and delete
// globals at teardown. On Node 26, own-property checks against a Proxy-backed
// vm context are always false (`Object.hasOwn(globalThis, 'setTimeout')`,
// `'setTimeout' in globalThis`), even though the descriptor exists. Restore
// logic that relies on those checks then deletes globals instead of restoring
// them: `jest.useRealTimers()` removes setTimeout and friends, and
// `jest.spyOn(global, ...).mockRestore()` removes the spied global. Hand vm a
// plain object instead, which only gives up Jest's teardown leak tracking.
const vm = require('node:vm');
const { types } = require('node:util');
const {
  TestEnvironment: ExpoNativeEnvironment,
} = require('jest-expo/src/preset/nativeEnvironment.js');

class NativeEnvironment extends ExpoNativeEnvironment {
  constructor(config, context) {
    const createContext = vm.createContext;
    vm.createContext = (object, options) =>
      createContext(types.isProxy(object) ? {} : object, options);
    try {
      super(config, context);
    } finally {
      vm.createContext = createContext;
    }
  }
}

module.exports = NativeEnvironment;
module.exports.TestEnvironment = NativeEnvironment;
