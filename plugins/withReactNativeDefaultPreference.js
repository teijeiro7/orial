const { withEntitlementsPlist } = require('@expo/config-plugins');

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

module.exports = function withReactNativeDefaultPreference(config) {
  config = withAppGroupsEntitlement(config);
  return config;
};
