const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Drizzle's Expo SQLite migrations import .sql files directly (see
// https://orm.drizzle.team/quick-sqlite/expo) — Metro needs to treat them as modules.
config.resolver.sourceExts.push('sql');
config.transformer.babelTransformerPath = require.resolve('./metro-sql-transformer');

module.exports = config;