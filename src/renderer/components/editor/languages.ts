import type { Language, LanguageOption } from '@shared/types/renderer/editor'

export const languages: LanguageOption[] = [
  {
    name: 'ABAP',
    value: 'abap',
    grammar: () => import('./grammars/abap.tmLanguage.json'),
    scopeName: 'source.abap'
  },
  // Возможно несоответствие
  {
    name: 'ABC',
    value: 'abc',
    grammar: () => import('./grammars/abc.tmLanguage.json'),
    scopeName: 'text.abcnotation'
  },
  {
    name: 'ActionScript',
    value: 'actionscript',
    grammar: () => import('./grammars/actionscript-3.tmLanguage.json'),
    scopeName: 'source.actionscript.3'
  },
  {
    name: 'ADA',
    value: 'ada',
    grammar: () => import('./grammars/ada.tmLanguage.json'),
    scopeName: 'source.ada'
  },
  {
    name: 'Alda',
    value: 'alda',
    grammar: () => import('./grammars/alda.tmLanguage.json'),
    scopeName: 'source.alda'
  },
  {
    name: 'Apache Conf',
    value: 'apache_conf',
    grammar: () => import('./grammars/apache.tmLanguage.json'),
    scopeName: 'source.apacheconf'
  },
  {
    name: 'Apex',
    value: 'apex',
    grammar: () => import('./grammars/apex.tmLanguage.json'),
    scopeName: 'source.apex'
  },
  {
    name: 'Apple Script',
    value: 'applescript',
    grammar: () => import('./grammars/applescript.tmLanguage.json'),
    scopeName: 'source.applescript'
  },
  {
    name: 'AsciiDoc',
    value: 'asciidoc',
    grammar: () => import('./grammars/asciidoctor.tmLanguage.json'),
    scopeName: 'text.asciidoc'
  },
  {
    name: 'ASL',
    value: 'asl',
    grammar: () => import('./grammars/asl.tmLanguage.json'),
    scopeName: 'source.asl'
  },
  {
    name: 'ASP vb.NET (VBScript)',
    value: 'asp_vb_net',
    grammar: () => import('./grammars/asp-vb-net.tmlanguage.json'),
    scopeName: 'source.asp.vb.net'
  },
  {
    name: 'Assembly x86',
    value: 'assembly_x86',
    grammar: () => import('./grammars/asm.tmLanguage.json'),
    scopeName: 'source.asm'
  },
  {
    name: 'AutoHotkey / AutoIt',
    value: 'autohotkey',
    grammar: () => import('./grammars/autohotkey.tmLanguage.json'),
    scopeName: 'source.ahk'
  },
  {
    name: 'Bash',
    value: 'sh',
    grammar: () => import('./grammars/shell-unix-bash.tmLanguage.json'),
    scopeName: 'source.shell'
  },
  {
    name: 'BatchFile',
    value: 'batchfile',
    grammar: () => import('./grammars/batchfile.tmLanguage.json'),
    scopeName: 'source.batchfile'
  },
  {
    name: 'Bicep',
    value: 'bicep',
    grammar: () => import('./grammars/bicep.tmLanguage.json'),
    scopeName: 'source.bicep'
  },
  {
    name: 'C and C++',
    value: 'c_cpp',
    grammar: () => import('./grammars/cpp.tmLanguage.json'),
    scopeName: 'source.cpp'
  },
  {
    name: 'C#',
    value: 'csharp',
    grammar: () => import('./grammars/csharp.tmLanguage.json'),
    scopeName: 'source.cs'
  },
  {
    name: 'Cirru',
    value: 'cirru',
    grammar: () => import('./grammars/cirru.tmLanguage.json'),
    scopeName: 'source.cirru'
  },
  {
    name: 'Clojure',
    value: 'clojure',
    grammar: () => import('./grammars/clojure.tmLanguage.json'),
    scopeName: 'source.clojure'
  },
  {
    name: 'Cobol',
    value: 'cobol',
    grammar: () => import('./grammars/cobol.tmLanguage.json'),
    scopeName: 'source.cobol'
  },
  {
    name: 'CoffeeScript',
    value: 'coffee',
    grammar: () => import('./grammars/coffee.tmLanguage.json'),
    scopeName: 'source.coffee'
  },
  {
    name: 'ColdFusion',
    value: 'coldfusion',
    grammar: () => import('./grammars/coldfusion.tmLanguage.json'),
    scopeName: 'text.cfml.basic'
  },
  {
    name: 'Crystal',
    value: 'crystal',
    grammar: () => import('./grammars/crystal.tmLanguage.json'),
    scopeName: 'source.crystal'
  },
  {
    name: 'Csound',
    value: 'csound_orchestra',
    grammar: () => import('./grammars/csound.tmLanguage.json'),
    scopeName: 'source.csound'
  },
  {
    name: 'Csound Document',
    value: 'csound_document',
    grammar: () => import('./grammars/csound-document.tmLanguage.json'),
    scopeName: 'source.csound-document'
  },
  {
    name: 'Csound Score',
    value: 'csound_score',
    grammar: () => import('./grammars/csound-score.tmLanguage.json'),
    scopeName: 'source.csound-score'
  },
  {
    name: 'CSS',
    value: 'css',
    grammar: () => import('./grammars/css.tmLanguage.json'),
    scopeName: 'source.css'
  },
  {
    name: 'Curly',
    value: 'curly',
    grammar: () => import('./grammars/curly.tmLanguage.json'),
    scopeName: 'text.html.curly'
  },
  {
    name: 'D',
    value: 'd',
    grammar: () => import('./grammars/d.tmLanguage.json'),
    scopeName: 'source.d'
  },
  {
    name: 'Dart',
    value: 'dart',
    grammar: () => import('./grammars/dart.tmLanguage.json'),
    scopeName: 'source.dart'
  },
  {
    name: 'Diff',
    value: 'diff',
    grammar: () => import('./grammars/diff.tmLanguage.json'),
    scopeName: 'source.diff'
  },
  {
    name: 'Django',
    value: 'django',
    grammar: () => import('./grammars/django.tmLanguage.json'),
    scopeName: 'source.python.django'
  },
  {
    name: 'Dockerfile',
    value: 'dockerfile',
    grammar: () => import('./grammars/docker.tmLanguage.json'),
    scopeName: 'source.dockerfile'
  },
  {
    name: 'Dot',
    value: 'dot',
    grammar: () => import('./grammars/dot.tmLanguage.json'),
    scopeName: 'source.dot'
  },
  {
    name: 'Drools',
    value: 'drools',
    grammar: () => import('./grammars/drools.tmLanguage.json'),
    scopeName: 'source.drools'
  },
  {
    name: 'Edifact',
    value: 'edifact',
    grammar: () => import('./grammars/edifact.tmLanguage.json'),
    scopeName: 'text.plain.edifact'
  },
  {
    name: 'Eiffel',
    value: 'eiffel',
    grammar: () => import('./grammars/eiffel.tmLanguage.json'),
    scopeName: 'source.eiffel'
  },
  {
    name: 'EJS',
    value: 'ejs',
    grammar: () => import('./grammars/ejs.tmLanguage.json'),
    scopeName: 'text.html.js'
  },
  {
    name: 'Elixir',
    value: 'elixir',
    grammar: () => import('./grammars/elixir.tmLanguage.json'),
    scopeName: 'source.elixir'
  },
  {
    name: 'Elm',
    value: 'elm',
    grammar: () => import('./grammars/elm.tmLanguage.json'),
    scopeName: 'source.elm'
  },
  {
    name: 'Erlang',
    value: 'erlang',
    grammar: () => import('./grammars/erlang.tmLanguage.json'),
    scopeName: 'source.erlang'
  },
  {
    name: 'Forth',
    value: 'forth',
    grammar: () => import('./grammars/forth.tmLanguage.json'),
    scopeName: 'source.forth'
  },
  {
    name: 'Fortran',
    value: 'fortran',
    grammar: () => import('./grammars/fortran.tmLanguage.json'),
    scopeName: 'source.fortran'
  },
  {
    name: 'F#',
    value: 'fsharp',
    grammar: () => import('./grammars/fsharp.tmLanguage.json'),
    scopeName: 'source.fsharp'
  },
  {
    name: 'Gcode',
    value: 'gcode',
    grammar: () => import('./grammars/gcode.tmLanguage.json'),
    scopeName: 'source.gcode'
  },
  {
    name: 'Gherkin',
    value: 'gherkin',
    grammar: () => import('./grammars/gherkin.tmLanguage.json'),
    scopeName: 'text.gherkin.feature'
  },
  {
    name: 'Gitignore',
    value: 'gitignore',
    grammar: () => import('./grammars/gitignore.tmLanguage.json'),
    scopeName: 'source.gitignore'
  },
  {
    name: 'Glsl',
    value: 'glsl',
    grammar: () => import('./grammars/glsl.tmLanguage.json'),
    scopeName: 'source.glsl'
  },
  {
    name: 'Go',
    value: 'golang',
    grammar: () => import('./grammars/go.tmLanguage.json'),
    scopeName: 'source.go'
  },
  {
    name: 'GraphQL',
    value: 'graphqlschema',
    grammar: () => import('./grammars/graphql.tmLanguage.json'),
    scopeName: 'source.graphql'
  },
  {
    name: 'Groovy',
    value: 'groovy',
    grammar: () => import('./grammars/groovy.tmLanguage.json'),
    scopeName: 'source.groovy'
  },
  {
    name: 'HAML',
    value: 'haml',
    grammar: () => import('./grammars/haml.tmLanguage.json'),
    scopeName: 'text.haml'
  },
  {
    name: 'Handlebars',
    value: 'handlebars',
    grammar: () => import('./grammars/handlebars.tmLanguage.json'),
    scopeName: 'text.html.handlebars'
  },
  // Возможно несоответствие
  {
    name: 'Haskell Cabal',
    value: 'haskell_cabal',
    grammar: () => import('./grammars/haskell-cabal.tmLanguage.json'),
    scopeName: 'source.cabal'
  },
  {
    name: 'Haskell',
    value: 'haskell',
    grammar: () => import('./grammars/haskell.tmLanguage.json'),
    scopeName: 'source.haskell'
  },
  {
    name: 'haXe',
    value: 'haxe',
    grammar: () => import('./grammars/haxe.tmLanguage.json'),
    scopeName: 'source.hx'
  },
  {
    name: 'Hjson',
    value: 'hjson',
    grammar: () => import('./grammars/hjson.tmLanguage.json'),
    scopeName: 'source.hjson'
  },
  {
    name: 'HTML (Elixir)',
    value: 'html_elixir',
    grammar: () => import('./grammars/html-elixir.tmLanguage.json'),
    scopeName: 'text.html.elixir'
  },
  {
    name: 'HTML (Ruby)',
    value: 'html_ruby',
    grammar: () => import('./grammars/html-ruby.tmLanguage.json'),
    scopeName: 'text.html.erb'
  },
  {
    name: 'HTML',
    value: 'html',
    grammar: () => import('./grammars/html.tmLanguage.json'),
    scopeName: 'text.html.basic'
  },
  {
    name: 'INI',
    value: 'ini',
    grammar: () => import('./grammars/ini.tmLanguage.json'),
    scopeName: 'source.ini'
  },
  {
    name: 'Io',
    value: 'io',
    grammar: () => import('./grammars/io.tmLanguage.json'),
    scopeName: 'source.io'
  },
  {
    name: 'Java',
    value: 'java',
    grammar: () => import('./grammars/java.tmLanguage.json'),
    scopeName: 'source.java'
  },
  {
    name: 'JavaScript',
    value: 'javascript',
    grammar: () => import('./grammars/javascript.tmLanguage.json'),
    scopeName: 'source.js'
  },
  {
    name: 'JSON',
    value: 'json',
    grammar: () => import('./grammars/json.tmLanguage.json'),
    scopeName: 'source.json'
  },
  {
    name: 'JSON5',
    value: 'json5',
    grammar: () => import('./grammars/json5.tmLanguage.json'),
    scopeName: 'source.json5'
  },
  {
    name: 'JSONiq',
    value: 'jsoniq',
    grammar: () => import('./grammars/jsoniq.tmLanguage.json'),
    scopeName: 'source.jsoniq'
  },
  {
    name: 'JSP',
    value: 'jsp',
    grammar: () => import('./grammars/jsp.tmLanguage.json'),
    scopeName: 'text.html.jsp'
  },
  // TODO: сделать общими стилизованые (.jsx, tsx) грамматики
  {
    name: 'JSX',
    value: 'jsx',
    grammar: () => import('./grammars/jsx.tmLanguage.json'),
    scopeName: 'source.jsx'
  },
  {
    name: 'Julia',
    value: 'julia',
    grammar: () => import('./grammars/julia.tmLanguage.json'),
    scopeName: 'source.julia'
  },
  {
    name: 'Kotlin',
    value: 'kotlin',
    grammar: () => import('./grammars/kotlin.tmLanguage.json'),
    scopeName: 'source.kotlin'
  },
  {
    name: 'Kusto (KQL)',
    value: 'kusto',
    grammar: () => import('./grammars/kusto.tmLanguage.json'),
    scopeName: 'source.kusto'
  },
  {
    name: 'LaTeX',
    value: 'latex',
    grammar: () => import('./grammars/latex.tmLanguage.json'),
    scopeName: 'text.tex.latex'
  },
  {
    name: 'Latte',
    value: 'latte',
    grammar: () => import('./grammars/latte.tmLanguage.json'),
    scopeName: 'source.latte'
  },
  {
    name: 'LESS',
    value: 'less',
    grammar: () => import('./grammars/less.tmLanguage.json'),
    scopeName: 'source.css.less'
  },
  {
    name: 'Liquid',
    value: 'liquid',
    grammar: () => import('./grammars/liquid.tmLanguage.json'),
    scopeName: 'source.liquid'
  },
  {
    name: 'Lisp',
    value: 'lisp',
    grammar: () => import('./grammars/lisp.tmLanguage.json'),
    scopeName: 'source.lisp'
  },
  {
    name: 'LiveScript',
    value: 'livescript',
    grammar: () => import('./grammars/livescript.tmLanguage.json'),
    scopeName: 'source.livescript'
  },
  {
    name: 'LSL',
    value: 'lsl',
    grammar: () => import('./grammars/lsl.tmLanguage.json'),
    scopeName: 'source.lsl'
  },
  {
    name: 'Lua',
    value: 'lua',
    grammar: () => import('./grammars/lua.tmLanguage.json'),
    scopeName: 'source.lua'
  },
  {
    name: 'Makefile',
    value: 'makefile',
    grammar: () => import('./grammars/make.tmLanguage.json'),
    scopeName: 'source.makefile'
  },
  {
    name: 'Markdown',
    value: 'markdown',
    grammar: () => import('./grammars/markdown.tmLanguage.json'),
    scopeName: 'text.html.markdown'
  },
  {
    name: 'Mask',
    value: 'mask',
    grammar: () => import('./grammars/mask.tmLanguage.json'),
    scopeName: 'source.mask'
  },
  {
    name: 'MATLAB',
    value: 'matlab',
    grammar: () => import('./grammars/matlab.tmLanguage.json'),
    scopeName: 'source.matlab'
  },
  {
    name: 'MediaWiki',
    value: 'mediawiki',
    grammar: () => import('./grammars/mediawiki.tmLanguage.json'),
    scopeName: 'text.html.mediawiki'
  },
  {
    name: 'MEL',
    value: 'mel',
    grammar: () => import('./grammars/mel.tmLanguage.json'),
    scopeName: 'source.mel'
  },
  {
    name: 'Mikrotik',
    value: 'mikrotik',
    grammar: () => import('./grammars/mikrotik.tmLanguage.json'),
    scopeName: 'source.mikrotik-script'
  },
  {
    name: 'MIPS',
    value: 'mips',
    grammar: () => import('./grammars/mips.tmLanguage.json'),
    scopeName: 'source.mips'
  },
  {
    name: 'MySQL',
    value: 'mysql',
    grammar: () => import('./grammars/mysql.tmLanguage.json'),
    scopeName: 'source.sql.mysql'
  },
  {
    name: 'Nginx',
    value: 'nginx',
    grammar: () => import('./grammars/nginx.tmLanguage.json'),
    scopeName: 'source.nginx'
  },
  {
    name: 'Nim',
    value: 'nim',
    grammar: () => import('./grammars/nim.tmLanguage.json'),
    scopeName: 'source.nim'
  },
  {
    name: 'Nix',
    value: 'nix',
    grammar: () => import('./grammars/nix.tmLanguage.json'),
    scopeName: 'source.nix'
  },
  {
    name: 'NSIS',
    value: 'nsis',
    grammar: () => import('./grammars/nsis.tmLanguage.json'),
    scopeName: 'source.nsis'
  },
  {
    name: 'Nunjucks',
    value: 'nunjucks',
    grammar: () => import('./grammars/nunjucks.tmLanguage.json'),
    scopeName: 'text.html.nunjucks'
  },
  {
    name: 'Objective-C',
    value: 'objectivec',
    grammar: () => import('./grammars/objective-c.tmLanguage.json'),
    scopeName: 'source.objc'
  },
  {
    name: 'OCaml',
    value: 'ocaml',
    grammar: () => import('./grammars/ocaml.tmLanguage.json'),
    scopeName: 'source.ocaml'
  },
  {
    name: 'OpenGL',
    value: 'glsl',
    grammar: () => import('./grammars/glsl.tmLanguage.json'),
    scopeName: 'source.glsl'
  },
  {
    name: 'Pascal',
    value: 'pascal',
    grammar: () => import('./grammars/pascal.tmLanguage.json'),
    scopeName: 'source.pascal'
  },
  {
    name: 'Perl',
    value: 'perl',
    grammar: () => import('./grammars/perl.tmLanguage.json'),
    scopeName: 'source.perl'
  },
  {
    name: 'pgSQL',
    value: 'pgsql',
    grammar: () => import('./grammars/pgsql.tmLanguage.json'),
    scopeName: 'source.pgsql'
  },
  {
    name: 'PHP (Blade Template)',
    value: 'php_laravel_blade',
    grammar: () => import('./grammars/php-blade.tmLanguage.json'),
    scopeName: 'text.html.php.blade'
  },
  {
    name: 'PHP',
    value: 'php',
    grammar: () => import('./grammars/php.tmLanguage.json'),
    scopeName: 'source.php'
  },
  {
    name: 'Pig',
    value: 'pig',
    grammar: () => import('./grammars/pig.tmLanguage.json'),
    scopeName: 'source.pig'
  },
  {
    name: 'Plain Text',
    value: 'plain_text',
    grammar: () => import('./grammars/plain-text.tmLanguage.json'),
    scopeName: 'text.plain'
  },
  {
    name: 'Powershell',
    value: 'powershell',
    grammar: () => import('./grammars/powershell.tmLanguage.json'),
    scopeName: 'source.powershell'
  },
  {
    name: 'Praat',
    value: 'praat',
    grammar: () => import('./grammars/praat.tmLanguage.json'),
    scopeName: 'source.praat'
  },
  {
    name: 'Prisma',
    value: 'prisma',
    grammar: () => import('./grammars/prisma.tmLanguage.json'),
    scopeName: 'source.prisma'
  },
  {
    name: 'Prolog',
    value: 'prolog',
    grammar: () => import('./grammars/prolog.tmLanguage.json'),
    scopeName: 'source.prolog'
  },
  {
    name: 'Properties',
    value: 'properties',
    grammar: () => import('./grammars/properties.tmLanguage.json'),
    scopeName: 'source.tm-properties'
  },
  {
    name: 'Protobuf',
    value: 'protobuf',
    grammar: () => import('./grammars/protobuf.tmLanguage.json'),
    scopeName: 'source.proto'
  },
  {
    name: 'Pug',
    value: 'pug',
    grammar: () => import('./grammars/pug.tmLanguage.json'),
    scopeName: 'text.pug'
  },
  {
    name: 'Puppet',
    value: 'puppet',
    grammar: () => import('./grammars/puppet.tmLanguage.json'),
    scopeName: 'source.puppet'
  },
  {
    name: 'Python',
    value: 'python',
    grammar: () => import('./grammars/python.tmLanguage.json'),
    scopeName: 'source.python'
  },
  {
    name: 'QML',
    value: 'qml',
    grammar: () => import('./grammars/qml.tmLanguage.json'),
    scopeName: 'source.qml'
  },
  {
    name: 'R',
    value: 'r',
    grammar: () => import('./grammars/r.tmLanguage.json'),
    scopeName: 'source.r'
  },
  {
    name: 'Raku',
    value: 'raku',
    grammar: () => import('./grammars/raku.tmLanguage.json'),
    scopeName: 'source.perl.6'
  },
  {
    name: 'Razor',
    value: 'razor',
    grammar: () => import('./grammars/razor.tmLanguage.json'),
    scopeName: 'text.aspnetcorerazor'
  },
  {
    name: 'Red',
    value: 'red',
    grammar: () => import('./grammars/red.tmLanguage.json'),
    scopeName: 'source.red'
  },
  {
    name: 'RegExp',
    value: 'regexp',
    grammar: () => import('./grammars/regexp.tmLanguage.json'),
    scopeName: 'source.regexp'
  },
  {
    name: 'RST',
    value: 'rst',
    grammar: () => import('./grammars/rst.tmLanguage.json'),
    scopeName: 'source.rst'
  },
  {
    name: 'Ruby',
    value: 'ruby',
    grammar: () => import('./grammars/ruby.tmLanguage.json'),
    scopeName: 'source.ruby'
  },
  {
    name: 'Rust',
    value: 'rust',
    grammar: () => import('./grammars/rust.tmLanguage.json'),
    scopeName: 'source.rust'
  },
  {
    name: 'SAS',
    value: 'sas',
    grammar: () => import('./grammars/sas.tmLanguage.json'),
    scopeName: 'source.sas'
  },
  {
    name: 'SASS',
    value: 'sass',
    grammar: () => import('./grammars/sass.tmLanguage.json'),
    scopeName: 'source.sass'
  },
  {
    name: 'SCAD',
    value: 'scad',
    grammar: () => import('./grammars/scad.tmLanguage.json'),
    scopeName: 'source.scad'
  },
  {
    name: 'Scala',
    value: 'scala',
    grammar: () => import('./grammars/scala.tmLanguage.json'),
    scopeName: 'source.scala'
  },
  {
    name: 'Scheme',
    value: 'scheme',
    grammar: () => import('./grammars/scheme.tmLanguage.json'),
    scopeName: 'source.scheme'
  },
  {
    name: 'sCrypt',
    value: 'scrypt',
    grammar: () => import('./grammars/scrypt.tmLanguage.json'),
    scopeName: 'source.scrypt'
  },
  {
    name: 'SCSS',
    value: 'scss',
    grammar: () => import('./grammars/scss.tmLanguage.json'),
    scopeName: 'source.css.scss'
  },
  {
    name: 'SJS',
    value: 'sjs',
    grammar: () => import('./grammars/sjs.tmLanguage.json'),
    scopeName: 'source.sjs'
  },
  {
    name: 'Slim',
    value: 'slim',
    grammar: () => import('./grammars/slim.tmLanguage.json'),
    scopeName: 'text.slim'
  },
  {
    name: 'Smalltalk',
    value: 'smalltalk',
    grammar: () => import('./grammars/smalltalk.tmLanguage.json'),
    scopeName: 'source.smalltalk'
  },
  {
    name: 'Smarty',
    value: 'smarty',
    grammar: () => import('./grammars/smarty.tmLanguage.json'),
    scopeName: 'source.smarty'
  },
  {
    name: 'Smithy',
    value: 'smithy',
    grammar: () => import('./grammars/smithy.tmLanguage.json'),
    scopeName: 'source.smithy'
  },
  {
    name: 'Solidity',
    value: 'solidity',
    grammar: () => import('./grammars/solidity.tmLanguage.json'),
    scopeName: 'source.solidity'
  },
  {
    name: 'Soy Template',
    value: 'soy_template',
    grammar: () => import('./grammars/soytemplate.tmLanguage.json'),
    scopeName: 'source.soy'
  },
  {
    name: 'SQL',
    value: 'sql',
    grammar: () => import('./grammars/sql.tmLanguage.json'),
    scopeName: 'source.sql'
  },
  {
    name: 'SQLServer',
    value: 'sqlserver',
    grammar: () => import('./grammars/sql.tmLanguage.json'),
    scopeName: 'source.sqlserver'
  },
  {
    name: 'Stylus',
    value: 'stylus',
    grammar: () => import('./grammars/less.tmLanguage.json'),
    scopeName: 'source.stylus'
  },
  {
    name: 'SVG',
    value: 'svg',
    grammar: () => import('./grammars/svg.tmLanguage.json'),
    scopeName: 'text.xml.svg'
  },
  {
    name: 'Swift',
    value: 'swift',
    grammar: () => import('./grammars/swift.tmLanguage.json'),
    scopeName: 'source.swift'
  },
  {
    name: 'Tcl',
    value: 'tcl',
    grammar: () => import('./grammars/tcl.tmLanguage.json'),
    scopeName: 'source.tcl'
  },
  {
    name: 'Terraform',
    value: 'terraform',
    grammar: () => import('./grammars/terraform.tmLanguage.json'),
    scopeName: 'source.terraform'
  },
  {
    name: 'Tex',
    value: 'tex',
    grammar: () => import('./grammars/tex.tmLanguage.json'),
    scopeName: 'text.tex'
  },
  {
    name: 'Textile',
    value: 'textile',
    grammar: () => import('./grammars/textile.tmLanguage.json'),
    scopeName: 'text.html.textile'
  },
  {
    name: 'TOML',
    value: 'toml',
    grammar: () => import('./grammars/toml.tmLanguage.json'),
    scopeName: 'source.toml'
  },
  {
    name: 'TSX',
    value: 'tsx',
    grammar: () => import('./grammars/tsx.tmLanguage.json'),
    scopeName: 'source.tsx'
  },
  {
    name: 'Twig',
    value: 'twig',
    grammar: () => import('./grammars/twig.tmLanguage.json'),
    scopeName: 'text.html.twig'
  },
  {
    name: 'TypeScript',
    value: 'typescript',
    grammar: () => import('./grammars/typescript.tmLanguage.json'),
    scopeName: 'source.ts'
  },
  {
    name: 'Vala',
    value: 'vala',
    grammar: () => import('./grammars/vala.tmLanguage.json'),
    scopeName: 'source.vala'
  },
  {
    name: 'Velocity',
    value: 'velocity',
    grammar: () => import('./grammars/velocity.tmLanguage.json'),
    scopeName: 'text.velocity'
  },
  {
    name: 'Verilog',
    value: 'verilog',
    grammar: () => import('./grammars/systemverilog.tmLanguage.json'),
    scopeName: 'source.systemverilog'
  },
  {
    name: 'VHDL',
    value: 'vhdl',
    grammar: () => import('./grammars/vhdl.tmLanguage.json'),
    scopeName: 'source.vhdl'
  },
  {
    name: 'Visualforce',
    value: 'visualforce',
    grammar: () => import('./grammars/visualforce.tmLanguage.json'),
    scopeName: 'text.visualforce.markup'
  },
  {
    name: 'Vue',
    value: 'vue',
    grammar: () => import('./grammars/vue.tmLanguage.json'),
    scopeName: 'text.html.vue'
  },
  {
    name: 'Wollok',
    value: 'wollok',
    grammar: () => import('./grammars/wollok.tmLanguage.json'),
    scopeName: 'source.wollok'
  },
  {
    name: 'XML',
    value: 'xml',
    grammar: () => import('./grammars/xml.tmLanguage.json'),
    scopeName: 'text.xml'
  },
  {
    name: 'XSL',
    value: 'xsl',
    grammar: () => import('./grammars/xsl.tmLanguage.json'),
    scopeName: 'text.xml.xsl'
  },
  {
    name: 'XQuery',
    value: 'xquery',
    grammar: () => import('./grammars/xquery.tmLanguage.json'),
    scopeName: 'source.xquery'
  },
  {
    name: 'YAML',
    value: 'yaml',
    grammar: () => import('./grammars/yaml.tmLanguage.json'),
    scopeName: 'source.yaml'
  },
  {
    name: 'Zeek',
    value: 'zeek',
    grammar: () => import('./grammars/zeek.tmLanguage.json'),
    scopeName: 'source.zeek'
  }
]

// Маппинг с версии v1
export const oldLanguageMap: Record<any, Language> = {
  azcli: 'plain_text',
  bat: 'sh',
  cameligo: 'plain_text',
  coffeescript: 'coffee',
  c: 'c_cpp',
  csp: 'plain_text',
  go: 'golang',
  graphql: 'graphqlschema',
  msdax: 'plain_text',
  'objective-c': 'objectivec',
  pascaligo: 'plain_text',
  postiats: 'plain_text',
  powerquery: 'plain_text',
  pug: 'jade',
  redis: 'plain_text',
  sb: 'plain_text',
  shell: 'sh',
  sol: 'plain_text',
  aes: 'plain_text',
  st: 'plain_text',
  vb: 'vbscript'
}
