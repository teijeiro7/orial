const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// SQL files are inlined as strings in migrations.js — no special resolver needed

module.exports = config;