// Metro config: lets the app import the website's translation dictionaries
// (../lib/i18n) so both apps share one source of copy.
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.watchFolders = [path.resolve(__dirname, "..", "lib", "i18n")];

module.exports = config;
