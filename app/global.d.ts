/// <reference types="nativewind/types" />

// TypeScript 6.0 added a diagnostic (TS2882) for side-effect imports of files
// with no module declaration. `global.css` is processed by NativeWind's
// Metro transform, not by tsc, so it needs an explicit ambient declaration.
declare module "*.css";
