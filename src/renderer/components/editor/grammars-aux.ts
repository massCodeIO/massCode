export const auxGrammars = [
  {
    source: 'source.sassdoc',
    language: 'sassdoc',
    grammar: () => import('./grammars/sassdoc.tmLanguage.json')
  },
  {
    source: 'source.less',
    language: 'less2',
    grammar: () => import('./grammars/less.tmLanguage.json')
  },
  {
    source: 'source.js.jquery',
    languages: 'jquery',
    grammar: () => import('./grammars/javascript.tmLanguage.json')
  },
  {
    source: 'source.c++',
    language: 'c++',
    grammar: () => import('./grammars/cpp.tmLanguage.json')
  },
  {
    source: 'source.c',
    language: 'c',
    grammar: () => import('./grammars/cpp.tmLanguage.json')
  },
  {
    source: 'source.cpp.embedded.macro',
    language: 'c-macro',
    grammar: () => import('./grammars/cpp.embedded.macro.tmLanguage.json')
  },
  {
    source: 'source.x86',
    language: 'x86',
    grammar: () => import('./grammars/asm.tmLanguage.json')
  },
  {
    source: 'source.x86_64',
    language: 'x86_64',
    grammar: () => import('./grammars/asm.tmLanguage.json')
  },
  {
    source: 'source.json.comments',
    language: 'json-comment',
    grammar: () => import('./grammars/jsonc.tmLanguage.json')
  },
  {
    source: 'source.js.regexp',
    language: 'regexp-javascript',
    grammar: () => import('./grammars/regexp-javascript.tmLanguage.json')
  },
  {
    source: 'source.regexp.python',
    language: 'regexp-python',
    grammar: () => import('./grammars/regexp-python.tmLanguage.json')
  },
  {
    source: 'text.bibtex',
    language: 'bibtex',
    grammar: () => import('./grammars/bibtex.tmLanguage.json')
  },
  {
    source: 'source.gnuplot',
    language: 'gnuplot',
    grammar: () => import('./grammars/gnuplot.tmLanguage.json')
  },
  {
    source: 'source.asymptote',
    language: 'asymptote',
    grammar: () => import('./grammars/asymptote.tmLanguage.json')
  },
  {
    source: 'source.arm',
    language: 'arm',
    grammar: () => import('./grammars/arm.tmLanguage.json')
  },
  {
    source: 'text.elixir',
    language: 'elixir2',
    grammar: () => import('./grammars/eex.tmLanguage.json')
  },
  // { source: 'source.elixir', language: 'elixir2', grammar: () => import('./grammars/elixir.tmLanguage.json') },
  {
    source: 'text.html.derivative',
    language: 'html-derivative',
    grammar: () => import('./grammars/html-derivative.tmLanguage.json')
  },
  {
    source: 'text.tex.markdown_latex_combined',
    language: 'markdown-latex-combined',
    grammar: () => import('./grammars/markdown-latex-combined.tmLanguage.json')
  },
  {
    source: 'source.cpp.embedded.latex',
    language: 'cpp-embedded-latex',
    grammar: () => import('./grammars/cpp-embedded-latex.tmLanguage.json')
  },
  {
    source: 'text.log',
    language: 'text-log',
    grammar: () => import('./grammars/log.tmLanguage.json')
  },
  {
    source: 'source.tsx',
    language: 'tsx',
    grammar: () => import('./grammars/tsx.tmLanguage.json')
  },
  {
    source: 'text.git-rebase',
    language: 'git-rebase',
    grammar: () => import('./grammars/git-rebase.tmLanguage.json')
  },
  {
    source: 'text.git-commit',
    language: 'git-commit',
    grammar: () => import('./grammars/git-commit.tmLanguage.json')
  },
  {
    source: 'text.html.javadoc',
    language: 'javadoc',
    grammar: () => import('./grammars/javadoc.tmLanguage.json')
  },
  {
    source: 'source.postscript',
    language: 'postscript',
    grammar: () => import('./grammars/postscript.tmLanguage.json')
  },
  {
    source: 'etc',
    language: 'etc',
    grammar: () => import('./grammars/etc.tmLanguage.json')
  }
]
