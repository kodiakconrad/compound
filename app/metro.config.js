const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// withNativeWind processes global.css through Tailwind at build time
module.exports = withNativeWind(config, { input: "./global.css" });
