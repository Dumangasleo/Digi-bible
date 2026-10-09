module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      // jsxImportSource wires NativeWind's className transform; babel-preset-expo
      // still reads app.json experiments (e.g. reactCompiler).
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
  };
};
