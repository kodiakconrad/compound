// App entry point — runs before expo-router loads any route file.
//
// NativeWind's style-interop layer (react-native-css-interop) remaps props on
// every core RN component it supports, including ImageBackground, at module
// load — unconditionally, whether or not the app actually renders one. As of
// React Native 0.88, touching ImageBackground at all logs a deprecation
// warning. Harmless (LogBox only runs in dev), but noisy.
//
// The ignore pattern has to be registered before that warning fires. Doing it
// in app/_layout.tsx is too late: its imports load NativeWind first, and once
// the warning is logged RN replaces it with a generic "Open debugger to view
// warnings." toast that the pattern no longer matches.
import { LogBox } from "react-native";

LogBox.ignoreLogs([/ImageBackground is deprecated/]);

// require (not import) so this runs after the ignoreLogs call above —
// imports are hoisted and would load the router first.
require("expo-router/entry");
