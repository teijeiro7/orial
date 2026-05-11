const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add .sql to asset extensions (not sourceExts) for drizzle migrations
config.resolver.assetExts = [...config.resolver.assetExts, 'sql'];

module.exports = config;