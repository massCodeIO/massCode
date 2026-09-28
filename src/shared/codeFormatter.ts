const parsers = {
  css: 'css',
  html: 'html',
  json: 'json',
  json5: 'json5',
  less: 'less',
  markdown: 'markdown',
  scss: 'scss',
  typescript: 'typescript',
  yaml: 'yaml',
  javascript: 'babel',
  graphqlschema: 'graphql',
} as const

export function getCodeFormatterParser(language: string | undefined) {
  return language && Object.hasOwn(parsers, language)
    ? parsers[language as keyof typeof parsers]
    : undefined
}

const supportedParsers = new Set<string>(Object.values(parsers))
export function isCodeFormatterParser(parser: string): boolean {
  return supportedParsers.has(parser)
}
