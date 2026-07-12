const fs = require('fs');
const path = require('path');
const { withDangerousMod, withXcodeProject, IOSConfig } = require('@expo/config-plugins');

const SWIFT_FILENAME = 'LogWaterIntent.swift';
const SOURCE_SWIFT_PATH = path.join(__dirname, 'ios', SWIFT_FILENAME);

function withWaterIntentSourceFile(config) {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const projectName = IOSConfig.XcodeUtils.getHackyProjectName(config.modRequest.projectRoot, config);
      const destinationDir = path.join(config.modRequest.platformProjectRoot, projectName);
      const destinationPath = path.join(destinationDir, SWIFT_FILENAME);

      fs.mkdirSync(destinationDir, { recursive: true });
      fs.copyFileSync(SOURCE_SWIFT_PATH, destinationPath);

      return config;
    },
  ]);
}

function withWaterIntentXcodeTarget(config) {
  return withXcodeProject(config, (config) => {
    const project = config.modResults;
    const projectName = IOSConfig.XcodeUtils.getHackyProjectName(config.modRequest.projectRoot, config);
    const filePath = `${projectName}/${SWIFT_FILENAME}`;

    if (!project.hasFile(filePath)) {
      IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
        filepath: filePath,
        groupName: projectName,
        project,
      });
    }

    config.modResults = project;
    return config;
  });
}

module.exports = function withWaterIntent(config) {
  config = withWaterIntentSourceFile(config);
  config = withWaterIntentXcodeTarget(config);
  return config;
};
