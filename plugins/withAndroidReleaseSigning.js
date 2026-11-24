const { withAppBuildGradle } = require("expo/config-plugins");

const RELEASE_SIGNING_MARKER = "CYBERVPN PERSISTENT RELEASE SIGNING";

const withAndroidReleaseSigning = (config) =>
  withAppBuildGradle(config, (modConfig) => {
    let source = modConfig.modResults.contents;

    // Expo prebuild can run repeatedly; do not duplicate the Gradle changes.
    if (source.includes(RELEASE_SIGNING_MARKER)) return modConfig;

    const androidBlock = source.indexOf("android {\n");
    const signingStart = source.indexOf("    signingConfigs {\n");
    const buildTypesStart = source.indexOf("    buildTypes {\n", signingStart);
    if (androidBlock < 0 || signingStart < 0 || buildTypesStart < 0) {
      throw new Error(
        "Could not find the expected Android Gradle signing blocks for CyberVPN release signing.",
      );
    }

    const preamble = `// ${RELEASE_SIGNING_MARKER}\ndef cyberVpnReleaseStoreFile = System.getenv("CYBERVPN_RELEASE_STORE_FILE")\ndef cyberVpnReleaseStorePassword = System.getenv("CYBERVPN_RELEASE_KEYSTORE_PASSWORD")\ndef cyberVpnReleaseKeyAlias = System.getenv("CYBERVPN_RELEASE_KEY_ALIAS")\ndef cyberVpnReleaseKeyPassword = System.getenv("CYBERVPN_RELEASE_KEY_PASSWORD")\ndef cyberVpnReleaseSigningRequired = "true".equalsIgnoreCase(System.getenv("CYBERVPN_REQUIRE_RELEASE_SIGNING"))\ndef cyberVpnHasReleaseSigning = [cyberVpnReleaseStoreFile, cyberVpnReleaseStorePassword, cyberVpnReleaseKeyAlias, cyberVpnReleaseKeyPassword].every { it != null && !it.trim().isEmpty() }\nif (cyberVpnReleaseSigningRequired && !cyberVpnHasReleaseSigning) {\n    throw new GradleException("CI release APK requires all CyberVPN persistent signing secrets; refusing to use the debug key.")\n}\n\n`;
    source =
      source.slice(0, androidBlock) + preamble + source.slice(androidBlock);

    const updatedSigningStart = source.indexOf("    signingConfigs {\n");
    const updatedBuildTypesStart = source.indexOf(
      "    buildTypes {\n",
      updatedSigningStart,
    );
    const signingBlock = source.slice(
      updatedSigningStart,
      updatedBuildTypesStart,
    );
    const closingBrace = signingBlock.lastIndexOf("    }\n");
    if (closingBrace < 0) {
      throw new Error(
        "Could not find the closing signingConfigs block in app/build.gradle.",
      );
    }
    const releaseSigningConfig = `        release {\n            if (cyberVpnHasReleaseSigning) {\n                storeFile file(cyberVpnReleaseStoreFile)\n                storeType "PKCS12"\n                storePassword cyberVpnReleaseStorePassword\n                keyAlias cyberVpnReleaseKeyAlias\n                keyPassword cyberVpnReleaseKeyPassword\n            }\n        }\n`;
    source =
      source.slice(0, updatedSigningStart) +
      signingBlock.slice(0, closingBrace) +
      releaseSigningConfig +
      signingBlock.slice(closingBrace) +
      source.slice(updatedBuildTypesStart);

    const releaseBuildTypesStart = source.indexOf("    buildTypes {\n");
    const releaseTypeStart = source.indexOf(
      "        release {\n",
      releaseBuildTypesStart,
    );
    const releaseSigningLine = source.indexOf(
      "            signingConfig signingConfigs.debug\n",
      releaseTypeStart,
    );
    if (releaseTypeStart < 0 || releaseSigningLine < 0) {
      throw new Error(
        "Could not find the release build's existing signingConfig line.",
      );
    }

    const oldLine = "            signingConfig signingConfigs.debug\n";
    const newLine = `            // ${RELEASE_SIGNING_MARKER}\n            signingConfig cyberVpnHasReleaseSigning ? signingConfigs.release : signingConfigs.debug\n`;
    source =
      source.slice(0, releaseSigningLine) +
      newLine +
      source.slice(releaseSigningLine + oldLine.length);

    modConfig.modResults.contents = source;
    return modConfig;
  });

module.exports = withAndroidReleaseSigning;
