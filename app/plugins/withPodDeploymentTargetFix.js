const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

// Some third-party pods (lottie-ios, react-native-svg, RNCAsyncStorage, ...)
// ship podspecs with an iOS deployment target older than the Xcode-enforced
// floor (15.0 as of Xcode 26/27). `expo-build-properties`'s
// `ios.deploymentTarget` only patches the main app target's build settings
// in project.pbxproj — it does NOT touch individual Pods targets, so it
// doesn't fix this. CocoaPods needs an explicit post_install hook to bump
// every pod target's IPHONEOS_DEPLOYMENT_TARGET.
//
// `ios/` is regenerated on every `expo prebuild`, so this has to be injected
// as a config plugin rather than hand-edited once.
const POST_INSTALL_SNIPPET = `
    # [withPodDeploymentTargetFix] Some pods ship an iOS deployment target
    # older than this Xcode's floor. Bump any pod target below the app's
    # deployment target up to match it.
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build_config|
        deployment_target = build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if deployment_target && deployment_target.to_f < 15.1
          build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.1'
        end
      end
    end
`;

function withPodDeploymentTargetFix(config) {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        "Podfile"
      );
      let contents = fs.readFileSync(podfilePath, "utf-8");

      if (contents.includes("[withPodDeploymentTargetFix]")) {
        return config;
      }

      const postInstallMatch = contents.match(
        /(post_install do \|installer\|\n)/
      );
      if (!postInstallMatch) {
        throw new Error(
          "withPodDeploymentTargetFix: couldn't find `post_install do |installer|` in the generated Podfile to patch."
        );
      }

      contents = contents.replace(
        postInstallMatch[1],
        postInstallMatch[1] + POST_INSTALL_SNIPPET
      );

      fs.writeFileSync(podfilePath, contents);
      return config;
    },
  ]);
}

module.exports = withPodDeploymentTargetFix;
