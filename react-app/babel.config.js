module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // Allows process.env.ANKURAH_TEST_MODE to be inlined at build time
    // Usage: ANKURAH_TEST_MODE=true npx react-native start --reset-cache
    'transform-inline-environment-variables',
  ],
};
