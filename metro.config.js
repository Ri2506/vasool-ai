// Metro config for VasoolAI.
//
// expo-sqlite's web implementation (wa-sqlite WASM) is only picked up when
// package exports are enabled. Without this flag, Metro resolves the main
// "expo-sqlite" entry which is native-only and the web bundle crashes at
// startup with `Cannot find native module 'ExpoSQLite'`.
// Ref: https://docs.expo.dev/versions/latest/sdk/sqlite/#web-support

const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.unstable_enablePackageExports = true;

module.exports = config;
