module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      // jsxImportSource: "nativewind" makes className work on JSX elements
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
  };
};
