const antfu = require('@antfu/eslint-config').default

module.exports = antfu({
  rules: {
    'vue/max-attributes-per-line': [
      'error',
      {
        singleline: 1,
      },
    ],
  },
  ignores: ['src/renderer/services/api/generated/**/*'],
})
