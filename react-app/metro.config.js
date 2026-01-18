const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

// Symlinked packages that Metro needs to watch
const ankurahReactHooks = path.resolve(__dirname, '../../ankurah-react-hooks');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  watchFolders: [ankurahReactHooks],
  resolver: {
    // Ensure external packages use this app's React, not their own
    extraNodeModules: {
      react: path.resolve(__dirname, 'node_modules/react'),
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
