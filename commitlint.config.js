module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'build',
        'chore',
        'ci',
        'docs',
        'feat',
        'fix',
        'polish',
        'refactor',
        'release',
        'revert',
        'style',
        'test',
        'types',
      ],
    ],
  },
}
