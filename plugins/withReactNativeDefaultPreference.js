const { withEntitlementsPlist, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const APP_GROUP = 'group.com.orial.app.widget';

function withAppGroupsEntitlement(config) {
  return withEntitlementsPlist(config, (config) => {
    const entitlements = config.modResults;
    const currentGroups = entitlements['com.apple.security.application-groups'] || [];
    if (!currentGroups.includes(APP_GROUP)) {
      entitlements['com.apple.security.application-groups'] = [...currentGroups, APP_GROUP];
    }
    return config;
  });
}

function withFollyCoroutinesFix(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      if (fs.existsSync(podfilePath)) {
        let content = await fs.promises.readFile(podfilePath, 'utf8');

        if (!content.includes('FOLLY_CFG_NO_COROUTINES')) {
          const targetLoopAnchor = "target.build_configurations.each do |build_config|";
          if (content.includes(targetLoopAnchor)) {
            const replacement = `${targetLoopAnchor}
        # Fix folly/coro/Coroutine.h not found error under C++20 standard
        flags = build_config.build_settings['OTHER_CPLUSPLUSFLAGS'] || '$(inherited)'
        if flags.is_a?(Array)
          build_config.build_settings['OTHER_CPLUSPLUSFLAGS'] = flags + ['-DFOLLY_CFG_NO_COROUTINES=1']
        else
          build_config.build_settings['OTHER_CPLUSPLUSFLAGS'] = flags + ' -DFOLLY_CFG_NO_COROUTINES=1'
        end`;
            content = content.replace(targetLoopAnchor, replacement);
            await fs.promises.writeFile(podfilePath, content, 'utf8');
          }
        }
      }
      return config;
    }
  ]);
}

module.exports = function withReactNativeDefaultPreference(config) {
  config = withAppGroupsEntitlement(config);
  config = withFollyCoroutinesFix(config);
  return config;
};
