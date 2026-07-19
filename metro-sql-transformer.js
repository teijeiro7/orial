const upstreamTransformer = require('@expo/metro-config/build/babel-transformer');
const fs = require('fs');

module.exports.transform = async ({ src, filename, options }) => {
  if (filename.endsWith('.sql')) {
    const sql = fs.readFileSync(filename, 'utf8');
    src = `module.exports = ${JSON.stringify(sql)};`;
  }
  return upstreamTransformer.transform({ src, filename, options });
};
