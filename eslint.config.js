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
})
