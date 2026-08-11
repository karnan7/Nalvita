module.exports = function babelConfig(api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { unstable_transformImportMeta: true }]],
    // Reanimated 4 runs through react-native-worklets; its plugin has to stay
    // last so it sees the fully transformed output.
    plugins: ['react-native-worklets/plugin'],
  };
};
