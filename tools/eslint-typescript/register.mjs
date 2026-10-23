// TypeScript 7 (the native compiler used by `tsc`) ships no JavaScript API, but typescript-eslint
// needs one. Redirect `typescript` imports made by typescript-eslint packages to the nested
// TypeScript 6 in this folder. Must be imported before typescript-eslint in eslint.config.js.
import { registerHooks } from 'node:module';

const TS_ESLINT_PARENT = /[\\/]node_modules[\\/](@typescript-eslint[\\/]|typescript-eslint[\\/]|ts-api-utils[\\/])/;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'typescript' && context.parentURL && TS_ESLINT_PARENT.test(context.parentURL)) {
      return nextResolve('eslint-typescript', context);
    }
    return nextResolve(specifier, context);
  },
});
