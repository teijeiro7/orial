const {
  withXcodeProject,
  withDangerousMod,
  IOSConfig,
} = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

const APP_GROUP = 'group.com.orial.app.widget';
const WIDGET_EXT_NAME = 'OrialWidget';

const WIDGET_SRC_DIR = path.join(__dirname, 'ios', WIDGET_EXT_NAME);
const MAIN_SRC_DIR = path.join(__dirname, 'ios');

const WIDGET_SWIFT_FILES = [
  'OrialWidgetBundle.swift',
  'SharedWidgetData.swift',
  'WidgetColors.swift',
  'ForgeWidget.swift',
  'PhysicalWidget.swift',
  'OverviewWidget.swift',
];

const WIDGET_MANAGER_FILES = ['WidgetManager.swift', 'WidgetManager.m'];

// -------- Copy source files into ios/OrialWidget/ and ios/{project}/ --------

function withWidgetSourceFiles(config) {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const projectName = IOSConfig.XcodeUtils.getHackyProjectName(
        config.modRequest.projectRoot,
        config
      );
      const platformRoot = config.modRequest.platformProjectRoot;

      // Widget Extension files → ios/OrialWidget/
      const destDir = path.join(platformRoot, WIDGET_EXT_NAME);
      fs.mkdirSync(destDir, { recursive: true });
      for (const file of WIDGET_SWIFT_FILES) {
        const src = path.join(WIDGET_SRC_DIR, file);
        const dest = path.join(destDir, file);
        if (fs.existsSync(src)) fs.copyFileSync(src, dest);
      }
      const plistSrc = path.join(WIDGET_SRC_DIR, 'Info.plist');
      if (fs.existsSync(plistSrc)) {
        fs.copyFileSync(plistSrc, path.join(destDir, 'Info.plist'));
      }

      // WidgetManager files → ios/{projectName}/
      const mainDestDir = path.join(platformRoot, projectName);
      fs.mkdirSync(mainDestDir, { recursive: true });
      for (const file of WIDGET_MANAGER_FILES) {
        const src = path.join(MAIN_SRC_DIR, file);
        const dest = path.join(mainDestDir, file);
        if (fs.existsSync(src)) fs.copyFileSync(src, dest);
      }

      return config;
    },
  ]);
}

// -------- Add Widget Extension target + WidgetManager files to Xcode project --------

function withWidgetXcodeTarget(config) {
  return withXcodeProject(config, (config) => {
    const project = config.modResults;

    const projectName = IOSConfig.XcodeUtils.getHackyProjectName(
      config.modRequest.projectRoot,
      config
    );

    // Always ensure entitlements file exists on disk (created every run, not just first)
    createWidgetEntitlementsFile(
      config.modRequest.platformProjectRoot,
      projectName
    );

    if (project.findTargetKey('"' + WIDGET_EXT_NAME + '"')) {
      return config;
    }

    // ── 1. Add Widget Extension target ──
    // addTarget creates the target, build configs, config list, product ref,
    // and CopyFiles embed phase in the main target. It stores the target name
    // quoted ('"OrialWidget"'), so look it up with the quoted form.
    project.addTarget(
      WIDGET_EXT_NAME,
      'app_extension',
      WIDGET_EXT_NAME,
      'com.orial.app.widget'
    );

    const quotedName = '"' + WIDGET_EXT_NAME + '"';
    const targetUuid = project.findTargetKey(quotedName);
    if (!targetUuid) {
      throw new Error('Failed to find OrialWidget target after addTarget');
    }

    // ── 2. Apply custom build settings ──
    const buildConfigs = project.pbxXCBuildConfigurationSection();
    for (const key of Object.keys(buildConfigs)) {
      const cfg = buildConfigs[key];
      if (
        cfg &&
        cfg.buildSettings &&
        cfg.buildSettings.PRODUCT_NAME === quotedName
      ) {
        cfg.buildSettings.INFOPLIST_FILE = `"${WIDGET_EXT_NAME}/Info.plist"`;
        cfg.buildSettings.SWIFT_VERSION = '5.0';
        cfg.buildSettings.IPHONEOS_DEPLOYMENT_TARGET = '15.1';
        cfg.buildSettings.CODE_SIGN_STYLE = 'Automatic';
        cfg.buildSettings.TARGETED_DEVICE_FAMILY = '"1,2"';
        cfg.buildSettings.MARKETING_VERSION = '1.0.0';
        cfg.buildSettings.CURRENT_PROJECT_VERSION = '1';
        cfg.buildSettings.DEFINES_MODULE = 'YES';
        cfg.buildSettings.ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES = 'YES';
        cfg.buildSettings.SWIFT_EMIT_LOC_STRINGS = 'YES';
        cfg.buildSettings.ENABLE_PREVIEWS = 'YES';

        if (cfg.name === 'Debug') {
          cfg.buildSettings.GCC_OPTIMIZATION_LEVEL = '0';
          cfg.buildSettings.ONLY_ACTIVE_ARCH = 'YES';
          cfg.buildSettings.SWIFT_OPTIMIZATION_LEVEL = '-Onone';
          cfg.buildSettings.SWIFT_ACTIVE_COMPILATION_CONDITIONS = '"DEBUG"';
          cfg.buildSettings.DEBUG_INFORMATION_FORMAT = 'dwarf';
          cfg.buildSettings.ENABLE_TESTABILITY = 'YES';
          cfg.buildSettings.MTL_ENABLE_DEBUG_INFO = '"INCLUDE_SOURCE"';
        } else {
          cfg.buildSettings.SWIFT_COMPILATION_MODE = 'wholemodule';
          cfg.buildSettings.SWIFT_OPTIMIZATION_LEVEL = '-O';
          cfg.buildSettings.VALIDATE_PRODUCT = 'YES';
          cfg.buildSettings.DEBUG_INFORMATION_FORMAT = 'dwarf-with-dsyn';
        }
      }
    }

    const objects = project.hash.project.objects;

    // ── 3. Create OrialWidget PBXGroup under the main project group ──
    const mainGroup = project.getFirstProject().firstProject.mainGroup;
    const widgetGroupUuid = project.generateUuid();
    objects['PBXGroup'][widgetGroupUuid] = {
      isa: 'PBXGroup',
      children: [],
      name: WIDGET_EXT_NAME,
      sourceTree: '"<group>"',
    };
    objects['PBXGroup'][widgetGroupUuid + '_comment'] = WIDGET_EXT_NAME;

    // Add the widget group to the main group's children
    const mainGroupObj = objects['PBXGroup'][mainGroup];
    if (mainGroupObj && mainGroupObj.children) {
      mainGroupObj.children.push({ value: widgetGroupUuid, comment: WIDGET_EXT_NAME });
    }

    // ── 4. Create build phases for the widget target ──
    const targetObj = objects['PBXNativeTarget'][targetUuid];

    // Sources phase
    const sourcesPhaseUuid = project.generateUuid();
    objects['PBXSourcesBuildPhase'] = objects['PBXSourcesBuildPhase'] || {};
    objects['PBXSourcesBuildPhase'][sourcesPhaseUuid] = {
      isa: 'PBXSourcesBuildPhase',
      buildActionMask: 2147483647,
      files: [],
      runOnlyForDeploymentPostprocessing: 0,
    };
    objects['PBXSourcesBuildPhase'][sourcesPhaseUuid + '_comment'] = 'Sources';
    targetObj.buildPhases.push({ value: sourcesPhaseUuid, comment: 'Sources' });

    // Frameworks phase
    const frameworksPhaseUuid = project.generateUuid();
    objects['PBXFrameworksBuildPhase'] = objects['PBXFrameworksBuildPhase'] || {};
    objects['PBXFrameworksBuildPhase'][frameworksPhaseUuid] = {
      isa: 'PBXFrameworksBuildPhase',
      buildActionMask: 2147483647,
      files: [],
      runOnlyForDeploymentPostprocessing: 0,
    };
    objects['PBXFrameworksBuildPhase'][frameworksPhaseUuid + '_comment'] = 'Frameworks';
    targetObj.buildPhases.push({ value: frameworksPhaseUuid, comment: 'Frameworks' });

    // Resources phase
    const resourcesPhaseUuid = project.generateUuid();
    objects['PBXResourcesBuildPhase'] = objects['PBXResourcesBuildPhase'] || {};
    objects['PBXResourcesBuildPhase'][resourcesPhaseUuid] = {
      isa: 'PBXResourcesBuildPhase',
      buildActionMask: 2147483647,
      files: [],
      runOnlyForDeploymentPostprocessing: 0,
    };
    objects['PBXResourcesBuildPhase'][resourcesPhaseUuid + '_comment'] = 'Resources';
    targetObj.buildPhases.push({ value: resourcesPhaseUuid, comment: 'Resources' });

    // ── 5. Add Swift source files ──
    for (const file of WIDGET_SWIFT_FILES) {
      const fileRefUuid = project.generateUuid();
      objects['PBXFileReference'][fileRefUuid] = {
        isa: 'PBXFileReference',
        explicitFileType: '"sourcecode.swift"',
        name: '"' + file + '"',
        path: '"' + WIDGET_EXT_NAME + '/' + file + '"',
        sourceTree: '"<group>"',
        fileEncoding: 4,
        lastKnownFileType: 'sourcecode.swift',
        includeInIndex: 0,
      };
      objects['PBXFileReference'][fileRefUuid + '_comment'] = file;

      // Add file ref to the widget group
      objects['PBXGroup'][widgetGroupUuid].children.push({ value: fileRefUuid, comment: file });

      const buildFileUuid = project.generateUuid();
      objects['PBXBuildFile'][buildFileUuid] = {
        isa: 'PBXBuildFile',
        fileRef: fileRefUuid,
      };
      objects['PBXBuildFile'][buildFileUuid + '_comment'] = `${file} in Sources`;

      objects['PBXSourcesBuildPhase'][sourcesPhaseUuid].files.push({
        value: buildFileUuid,
        comment: `${file} in Sources`,
      });
    }

    // ── 6. Add Info.plist (file ref only — processed via INFOPLIST_FILE build setting) ──
    const plistRefUuid = project.generateUuid();
    objects['PBXFileReference'][plistRefUuid] = {
      isa: 'PBXFileReference',
      explicitFileType: '"text.plist.xml"',
      name: '"Info.plist"',
      path: '"' + WIDGET_EXT_NAME + '/Info.plist"',
      sourceTree: '"<group>"',
      fileEncoding: 4,
      lastKnownFileType: 'text.plist.xml',
      includeInIndex: 0,
    };
    objects['PBXFileReference'][plistRefUuid + '_comment'] = 'Info.plist';
    objects['PBXGroup'][widgetGroupUuid].children.push({ value: plistRefUuid, comment: 'Info.plist' });

    // ── 7. Add WidgetKit + SwiftUI frameworks ──
    for (const frameworkName of ['WidgetKit.framework', 'SwiftUI.framework']) {
      const fwFileRef = project.generateUuid();
      objects['PBXFileReference'][fwFileRef] = {
        isa: 'PBXFileReference',
        explicitFileType: '"wrapper.framework"',
        path: '"' + frameworkName + '"',
        sourceTree: 'SDKROOT',
      };
      objects['PBXFileReference'][fwFileRef + '_comment'] = frameworkName;

      const fwBuildUuid = project.generateUuid();
      objects['PBXBuildFile'][fwBuildUuid] = {
        isa: 'PBXBuildFile',
        fileRef: fwFileRef,
      };
      objects['PBXBuildFile'][fwBuildUuid + '_comment'] = `${frameworkName} in Frameworks`;

      objects['PBXFrameworksBuildPhase'][frameworksPhaseUuid].files.push({
        value: fwBuildUuid,
        comment: `${frameworkName} in Frameworks`,
      });
    }

    // ── 8. Add target dependency from main target ──
    // Ensure the target dependency sections exist before calling addTargetDependency
    if (!objects['PBXTargetDependency']) objects['PBXTargetDependency'] = {};
    if (!objects['PBXContainerItemProxy']) objects['PBXContainerItemProxy'] = {};
    const mainTarget = project.getFirstTarget();
    if (mainTarget) {
      project.addTargetDependency(mainTarget.uuid, [targetUuid]);
    }

    // ── 9. Register WidgetManager native module files in main target ──
    for (const file of WIDGET_MANAGER_FILES) {
      const filePath = `${projectName}/${file}`;
      if (!project.hasFile(filePath)) {
        IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
          filepath: filePath,
          groupName: projectName,
          project,
        });
      }
    }

    // ── 10. Set CODE_SIGN_ENTITLEMENTS on widget target build configs ──
    for (const key of Object.keys(buildConfigs)) {
      const cfg = buildConfigs[key];
      if (
        cfg &&
        cfg.buildSettings &&
        cfg.buildSettings.PRODUCT_NAME === quotedName
      ) {
        cfg.buildSettings.CODE_SIGN_ENTITLEMENTS = `"${WIDGET_EXT_NAME}/${WIDGET_EXT_NAME}.entitlements"`;
      }
    }

    config.modResults = project;
    return config;
  });
}

// -------- Entitlements file creation (called from withWidgetXcodeTarget) ----------

function createWidgetEntitlementsFile(projectPath, projectName) {
  const content = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.application-groups</key>
  <array>
    <string>${APP_GROUP}</string>
  </array>
</dict>
</plist>`;
  const entitlementsPath = path.join(
    projectPath,
    WIDGET_EXT_NAME,
    `${WIDGET_EXT_NAME}.entitlements`
  );
  fs.mkdirSync(path.dirname(entitlementsPath), { recursive: true });
  fs.writeFileSync(entitlementsPath, content, 'utf-8');
}

module.exports = function withWidgetExtension(config) {
  config = withWidgetSourceFiles(config);
  config = withWidgetXcodeTarget(config);
  return config;
};
