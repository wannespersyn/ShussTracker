// Metro config: lets the app import the website's translation dictionaries
// (../lib/i18n) and its pure game logic (../lib, via the @shared alias) so
// web and app share one source of copy and rules.
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.watchFolders = [path.resolve(__dirname, "..", "lib")];

module.exports = config;
