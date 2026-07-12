const { withPodfile } = require('@expo/config-plugins');

const MARKER_START = '# withFmtCppStandardFix:start';
const MARKER_END = '# withFmtCppStandardFix:end';

const POST_INSTALL_SNIPPET = `
    ${MARKER_START}
    # fmt: Xcode 26's clang enforces consteval format-string checks that fmt 11 fails.
    # Forcing C++17 for this pod disables the FMT_CONSTEVAL codepath.
    installer.pods_project.targets.each do |target|
      if target.name == 'fmt'
        target.build_configurations.each do |config|
          config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
        end
      end
    end

    # folly: newer clang detects native coroutine support, tripping folly's
    # FOLLY_HAS_COROUTINES codepath which includes a header the pod doesn't ship.
    installer.pods_project.build_configurations.each do |config|
      defs = config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] || ['$(inherited)']
      defs << 'FOLLY_CFG_NO_COROUTINES=1' unless defs.include?('FOLLY_CFG_NO_COROUTINES=1')
      config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] = defs
    end
    ${MARKER_END}
`;

function withFmtCppStandardFix(config) {
  return withPodfile(config, (config) => {
    let contents = config.modResults.contents;

    if (contents.includes(MARKER_START)) {
      const blockPattern = new RegExp(
        `\\n *${MARKER_START}[\\s\\S]*?${MARKER_END}\\n`,
        'm'
      );
      contents = contents.replace(blockPattern, '\n');
    }

    const anchor = ':ccache_enabled => ccache_enabled?(podfile_properties),\n    )';
    if (!contents.includes(anchor)) {
      config.modResults.contents = contents;
      return config;
    }

    config.modResults.contents = contents.replace(
      anchor,
      `${anchor}\n${POST_INSTALL_SNIPPET}`
    );
    return config;
  });
}

module.exports = withFmtCppStandardFix;
