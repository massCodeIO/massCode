// Технические грамматики для поддержки синтаксиса внутри других языков или специальных случаев
export const auxGrammars = [
  {
    source: 'source.sassdoc',
    language: 'sassdoc',
    grammar: () => import('./textmate/sassdoc.tmLanguage.json'),
  },
  {
    source: 'source.scss',
    language: 'scss2',
    grammar: () => import('./textmate/scss.tmLanguage.json'),
  },
  {
    source: 'source.css.nunjucks',
    language: 'css-nunjucks',
    grammar: () => import('./textmate/css.tmLanguage.json'),
  },
  {
    source: 'source.less',
    language: 'less2',
    grammar: () => import('./textmate/less.tmLanguage.json'),
  },
  {
    source: 'source.postcss',
    language: 'postcss',
    grammar: () => import('./textmate/postcss.tmLanguage.json'),
  },
  {
    source: 'source.js.jquery',
    languages: 'jquery',
    grammar: () => import('./textmate/javascript.tmLanguage.json'),
  },
  {
    source: 'source.c++',
    language: 'c++',
    grammar: () => import('./textmate/cpp.tmLanguage.json'),
  },
  {
    source: 'source.c',
    language: 'c',
    grammar: () => import('./textmate/cpp.tmLanguage.json'),
  },
  {
    source: 'source.cpp.embedded.macro',
    language: 'c-macro',
    grammar: () => import('./textmate/cpp.embedded.macro.tmLanguage.json'),
  },
  {
    source: 'source.x86',
    language: 'x86',
    grammar: () => import('./textmate/asm.tmLanguage.json'),
  },
  {
    source: 'source.x86_64',
    language: 'x86_64',
    grammar: () => import('./textmate/asm.tmLanguage.json'),
  },
  {
    source: 'source.json.comments',
    language: 'json-comment',
    grammar: () => import('./textmate/jsonc.tmLanguage.json'),
  },
  {
    source: 'source.js.regexp',
    language: 'regexp-javascript',
    grammar: () => import('./textmate/regexp-javascript.tmLanguage.json'),
  },
  {
    source: 'source.regexp.python',
    language: 'regexp-python',
    grammar: () => import('./textmate/regexp-python.tmLanguage.json'),
  },
  {
    source: 'source.regexp.posix',
    language: 'regexp-posix',
    grammar: () => import('./textmate/regexp-posix.tmLanguage.json'),
  },
  {
    source: 'source.regexp.extended',
    language: 'regexp-extended',
    grammar: () => import('./textmate/regexp-extended.tmLanguage.json'),
  },
  {
    source: 'source.sy',
    language: 'sy',
    grammar: () => import('./textmate/syon.tmLanguage.json'),
  },
  {
    source: 'text.bibtex',
    language: 'bibtex',
    grammar: () => import('./textmate/bibtex.tmLanguage.json'),
  },
  {
    source: 'source.gnuplot',
    language: 'gnuplot',
    grammar: () => import('./textmate/gnuplot.tmLanguage.json'),
  },
  {
    source: 'source.asymptote',
    language: 'asymptote',
    grammar: () => import('./textmate/asymptote.tmLanguage.json'),
  },
  {
    source: 'source.arm',
    language: 'arm',
    grammar: () => import('./textmate/arm.tmLanguage.json'),
  },
  {
    source: 'text.elixir',
    language: 'elixir2',
    grammar: () => import('./textmate/eex.tmLanguage.json'),
  },
  {
    source: 'text.html.derivative',
    language: 'html-derivative',
    grammar: () => import('./textmate/html-derivative.tmLanguage.json'),
  },
  {
    source: 'text.tex.markdown_latex_combined',
    language: 'markdown-latex-combined',
    grammar: () => import('./textmate/markdown-latex-combined.tmLanguage.json'),
  },
  {
    source: 'source.cpp.embedded.latex',
    language: 'cpp-embedded-latex',
    grammar: () => import('./textmate/cpp-embedded-latex.tmLanguage.json'),
  },
  {
    source: 'text.log',
    language: 'text-log',
    grammar: () => import('./textmate/log.tmLanguage.json'),
  },
  {
    source: 'text.git-rebase',
    language: 'git-rebase',
    grammar: () => import('./textmate/git-rebase.tmLanguage.json'),
  },
  {
    source: 'text.git-commit',
    language: 'git-commit',
    grammar: () => import('./textmate/git-commit.tmLanguage.json'),
  },
  {
    source: 'text.html.javadoc',
    language: 'javadoc',
    grammar: () => import('./textmate/javadoc.tmLanguage.json'),
  },
  {
    source: 'source.postscript',
    language: 'postscript',
    grammar: () => import('./textmate/postscript.tmLanguage.json'),
  },
  {
    source: 'etc',
    language: 'etc',
    grammar: () => import('./textmate/etc.tmLanguage.json'),
  },
  {
    source: 'source.cfscript',
    language: 'cfscript',
    grammar: () => import('./textmate/cfscript.tmLanguage.json'),
  },
  {
    source: 'text.html.cfm',
    language: 'html-cfm',
    grammar: () => import('./textmate/html-cfml.tmLanguage.json'),
  },
  {
    source: 'source.js.jsx',
    language: 'jsx2',
    grammar: () => import('./textmate/jsx.tmLanguage.json'),
  },
  {
    source: 'text.html.php',
    language: 'php2',
    grammar: () => import('./textmate/php.tmLanguage.json'),
  },
  {
    source: 'source.xq',
    language: 'xq',
    grammar: () => import('./textmate/xquery.tmLanguage.json'),
  },
  {
    source: 'source.md',
    language: 'md',
    grammar: () => import('./textmate/markdown.tmLanguage.json'),
  },
  {
    source: 'source.erb',
    language: 'erb',
    grammar: () => import('./textmate/html-ruby.tmLanguage.json'),
  },
  {
    source: 'text.jade',
    language: 'jade',
    grammar: () => import('./textmate/pug.tmLanguage.json'),
  },
  {
    source: 'text.slm',
    language: 'slm',
    grammar: () => import('./textmate/slm.tmLanguage.json'),
  },
]
