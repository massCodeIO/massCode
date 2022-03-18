import ace from 'ace-builds'

ace.config.setModuleUrl(
  'ace/ext/beautify',
  await import('ace-builds/src-noconflict/ext-beautify')
)
ace.config.setModuleUrl(
  'ace/ext/code_lens',
  await import('ace-builds/src-noconflict/ext-code_lens')
)
ace.config.setModuleUrl(
  'ace/ext/elastic_tabstops_lite',
  await import('ace-builds/src-noconflict/ext-elastic_tabstops_lite')
)
ace.config.setModuleUrl(
  'ace/ext/emmet',
  await import('ace-builds/src-noconflict/ext-emmet')
)
ace.config.setModuleUrl(
  'ace/ext/error_marker',
  await import('ace-builds/src-noconflict/ext-error_marker')
)
ace.config.setModuleUrl(
  'ace/ext/hardwrap',
  await import('ace-builds/src-noconflict/ext-hardwrap')
)
ace.config.setModuleUrl(
  'ace/ext/keyboard_menu',
  await import('ace-builds/src-noconflict/ext-keybinding_menu')
)
ace.config.setModuleUrl(
  'ace/ext/language_tools',
  await import('ace-builds/src-noconflict/ext-language_tools')
)
ace.config.setModuleUrl(
  'ace/ext/linking',
  await import('ace-builds/src-noconflict/ext-linking')
)
ace.config.setModuleUrl(
  'ace/ext/modelist',
  await import('ace-builds/src-noconflict/ext-modelist')
)
ace.config.setModuleUrl(
  'ace/ext/options',
  await import('ace-builds/src-noconflict/ext-options')
)
ace.config.setModuleUrl(
  'ace/ext/prompt',
  await import('ace-builds/src-noconflict/ext-prompt')
)
ace.config.setModuleUrl(
  'ace/ext/rtl',
  await import('ace-builds/src-noconflict/ext-rtl')
)
ace.config.setModuleUrl(
  'ace/ext/searchbox',
  await import('ace-builds/src-noconflict/ext-searchbox')
)
ace.config.setModuleUrl(
  'ace/ext/settings_menu',
  await import('ace-builds/src-noconflict/ext-settings_menu')
)
ace.config.setModuleUrl(
  'ace/ext/spellcheck',
  await import('ace-builds/src-noconflict/ext-spellcheck')
)
ace.config.setModuleUrl(
  'ace/ext/split',
  await import('ace-builds/src-noconflict/ext-split')
)
ace.config.setModuleUrl(
  'ace/ext/static_highlight',
  await import('ace-builds/src-noconflict/ext-static_highlight')
)
ace.config.setModuleUrl(
  'ace/ext/statusbar',
  await import('ace-builds/src-noconflict/ext-statusbar')
)
ace.config.setModuleUrl(
  'ace/ext/textarea',
  await import('ace-builds/src-noconflict/ext-textarea')
)
ace.config.setModuleUrl(
  'ace/ext/themelist',
  await import('ace-builds/src-noconflict/ext-themelist')
)
ace.config.setModuleUrl(
  'ace/ext/whitespace',
  await import('ace-builds/src-noconflict/ext-whitespace')
)
ace.config.setModuleUrl(
  'ace/keyboard/emacs',
  await import('ace-builds/src-noconflict/keybinding-emacs')
)
ace.config.setModuleUrl(
  'ace/keyboard/sublime',
  await import('ace-builds/src-noconflict/keybinding-sublime')
)
ace.config.setModuleUrl(
  'ace/keyboard/vim',
  await import('ace-builds/src-noconflict/keybinding-vim')
)
ace.config.setModuleUrl(
  'ace/keyboard/vscode',
  await import('ace-builds/src-noconflict/keybinding-vscode')
)
ace.config.setModuleUrl(
  'ace/mode/abap',
  await import('ace-builds/src-noconflict/mode-abap')
)
ace.config.setModuleUrl(
  'ace/mode/abc',
  await import('ace-builds/src-noconflict/mode-abc')
)
ace.config.setModuleUrl(
  'ace/mode/actionscript',
  await import('ace-builds/src-noconflict/mode-actionscript')
)
ace.config.setModuleUrl(
  'ace/mode/ada',
  await import('ace-builds/src-noconflict/mode-ada')
)
ace.config.setModuleUrl(
  'ace/mode/alda',
  await import('ace-builds/src-noconflict/mode-alda')
)
ace.config.setModuleUrl(
  'ace/mode/apache_conf',
  await import('ace-builds/src-noconflict/mode-apache_conf')
)
ace.config.setModuleUrl(
  'ace/mode/apex',
  await import('ace-builds/src-noconflict/mode-apex')
)
ace.config.setModuleUrl(
  'ace/mode/applescript',
  await import('ace-builds/src-noconflict/mode-applescript')
)
ace.config.setModuleUrl(
  'ace/mode/aql',
  await import('ace-builds/src-noconflict/mode-aql')
)
ace.config.setModuleUrl(
  'ace/mode/asciidoc',
  await import('ace-builds/src-noconflict/mode-asciidoc')
)
ace.config.setModuleUrl(
  'ace/mode/asl',
  await import('ace-builds/src-noconflict/mode-asl')
)
ace.config.setModuleUrl(
  'ace/mode/assembly_x86',
  await import('ace-builds/src-noconflict/mode-assembly_x86')
)
ace.config.setModuleUrl(
  'ace/mode/autohotkey',
  await import('ace-builds/src-noconflict/mode-autohotkey')
)
ace.config.setModuleUrl(
  'ace/mode/batchfile',
  await import('ace-builds/src-noconflict/mode-batchfile')
)
ace.config.setModuleUrl(
  'ace/mode/c9search',
  await import('ace-builds/src-noconflict/mode-c9search')
)
ace.config.setModuleUrl(
  'ace/mode/cirru',
  await import('ace-builds/src-noconflict/mode-cirru')
)
ace.config.setModuleUrl(
  'ace/mode/clojure',
  await import('ace-builds/src-noconflict/mode-clojure')
)
ace.config.setModuleUrl(
  'ace/mode/cobol',
  await import('ace-builds/src-noconflict/mode-cobol')
)
ace.config.setModuleUrl(
  'ace/mode/coffee',
  await import('ace-builds/src-noconflict/mode-coffee')
)
ace.config.setModuleUrl(
  'ace/mode/coldfusion',
  await import('ace-builds/src-noconflict/mode-coldfusion')
)
ace.config.setModuleUrl(
  'ace/mode/crystal',
  await import('ace-builds/src-noconflict/mode-crystal')
)
ace.config.setModuleUrl(
  'ace/mode/csharp',
  await import('ace-builds/src-noconflict/mode-csharp')
)
ace.config.setModuleUrl(
  'ace/mode/csound_document',
  await import('ace-builds/src-noconflict/mode-csound_document')
)
ace.config.setModuleUrl(
  'ace/mode/csound_orchestra',
  await import('ace-builds/src-noconflict/mode-csound_orchestra')
)
ace.config.setModuleUrl(
  'ace/mode/csound_score',
  await import('ace-builds/src-noconflict/mode-csound_score')
)
ace.config.setModuleUrl(
  'ace/mode/csp',
  await import('ace-builds/src-noconflict/mode-csp')
)
ace.config.setModuleUrl(
  'ace/mode/css',
  await import('ace-builds/src-noconflict/mode-css')
)
ace.config.setModuleUrl(
  'ace/mode/curly',
  await import('ace-builds/src-noconflict/mode-curly')
)
ace.config.setModuleUrl(
  'ace/mode/c_cpp',
  await import('ace-builds/src-noconflict/mode-c_cpp')
)
ace.config.setModuleUrl(
  'ace/mode/d',
  await import('ace-builds/src-noconflict/mode-d')
)
ace.config.setModuleUrl(
  'ace/mode/dart',
  await import('ace-builds/src-noconflict/mode-dart')
)
ace.config.setModuleUrl(
  'ace/mode/diff',
  await import('ace-builds/src-noconflict/mode-diff')
)
ace.config.setModuleUrl(
  'ace/mode/django',
  await import('ace-builds/src-noconflict/mode-django')
)
ace.config.setModuleUrl(
  'ace/mode/dockerfile',
  await import('ace-builds/src-noconflict/mode-dockerfile')
)
ace.config.setModuleUrl(
  'ace/mode/dot',
  await import('ace-builds/src-noconflict/mode-dot')
)
ace.config.setModuleUrl(
  'ace/mode/drools',
  await import('ace-builds/src-noconflict/mode-drools')
)
ace.config.setModuleUrl(
  'ace/mode/edifact',
  await import('ace-builds/src-noconflict/mode-edifact')
)
ace.config.setModuleUrl(
  'ace/mode/eiffel',
  await import('ace-builds/src-noconflict/mode-eiffel')
)
ace.config.setModuleUrl(
  'ace/mode/ejs',
  await import('ace-builds/src-noconflict/mode-ejs')
)
ace.config.setModuleUrl(
  'ace/mode/elixir',
  await import('ace-builds/src-noconflict/mode-elixir')
)
ace.config.setModuleUrl(
  'ace/mode/elm',
  await import('ace-builds/src-noconflict/mode-elm')
)
ace.config.setModuleUrl(
  'ace/mode/erlang',
  await import('ace-builds/src-noconflict/mode-erlang')
)
ace.config.setModuleUrl(
  'ace/mode/forth',
  await import('ace-builds/src-noconflict/mode-forth')
)
ace.config.setModuleUrl(
  'ace/mode/fortran',
  await import('ace-builds/src-noconflict/mode-fortran')
)
ace.config.setModuleUrl(
  'ace/mode/fsharp',
  await import('ace-builds/src-noconflict/mode-fsharp')
)
ace.config.setModuleUrl(
  'ace/mode/fsl',
  await import('ace-builds/src-noconflict/mode-fsl')
)
ace.config.setModuleUrl(
  'ace/mode/ftl',
  await import('ace-builds/src-noconflict/mode-ftl')
)
ace.config.setModuleUrl(
  'ace/mode/gcode',
  await import('ace-builds/src-noconflict/mode-gcode')
)
ace.config.setModuleUrl(
  'ace/mode/gherkin',
  await import('ace-builds/src-noconflict/mode-gherkin')
)
ace.config.setModuleUrl(
  'ace/mode/gitignore',
  await import('ace-builds/src-noconflict/mode-gitignore')
)
ace.config.setModuleUrl(
  'ace/mode/glsl',
  await import('ace-builds/src-noconflict/mode-glsl')
)
ace.config.setModuleUrl(
  'ace/mode/gobstones',
  await import('ace-builds/src-noconflict/mode-gobstones')
)
ace.config.setModuleUrl(
  'ace/mode/golang',
  await import('ace-builds/src-noconflict/mode-golang')
)
ace.config.setModuleUrl(
  'ace/mode/graphqlschema',
  await import('ace-builds/src-noconflict/mode-graphqlschema')
)
ace.config.setModuleUrl(
  'ace/mode/groovy',
  await import('ace-builds/src-noconflict/mode-groovy')
)
ace.config.setModuleUrl(
  'ace/mode/haml',
  await import('ace-builds/src-noconflict/mode-haml')
)
ace.config.setModuleUrl(
  'ace/mode/handlebars',
  await import('ace-builds/src-noconflict/mode-handlebars')
)
ace.config.setModuleUrl(
  'ace/mode/haskell',
  await import('ace-builds/src-noconflict/mode-haskell')
)
ace.config.setModuleUrl(
  'ace/mode/haskell_cabal',
  await import('ace-builds/src-noconflict/mode-haskell_cabal')
)
ace.config.setModuleUrl(
  'ace/mode/haxe',
  await import('ace-builds/src-noconflict/mode-haxe')
)
ace.config.setModuleUrl(
  'ace/mode/hjson',
  await import('ace-builds/src-noconflict/mode-hjson')
)
ace.config.setModuleUrl(
  'ace/mode/html',
  await import('ace-builds/src-noconflict/mode-html')
)
ace.config.setModuleUrl(
  'ace/mode/html_elixir',
  await import('ace-builds/src-noconflict/mode-html_elixir')
)
ace.config.setModuleUrl(
  'ace/mode/html_ruby',
  await import('ace-builds/src-noconflict/mode-html_ruby')
)
ace.config.setModuleUrl(
  'ace/mode/ini',
  await import('ace-builds/src-noconflict/mode-ini')
)
ace.config.setModuleUrl(
  'ace/mode/io',
  await import('ace-builds/src-noconflict/mode-io')
)
ace.config.setModuleUrl(
  'ace/mode/jack',
  await import('ace-builds/src-noconflict/mode-jack')
)
ace.config.setModuleUrl(
  'ace/mode/jade',
  await import('ace-builds/src-noconflict/mode-jade')
)
ace.config.setModuleUrl(
  'ace/mode/java',
  await import('ace-builds/src-noconflict/mode-java')
)
ace.config.setModuleUrl(
  'ace/mode/javascript',
  await import('ace-builds/src-noconflict/mode-javascript')
)
ace.config.setModuleUrl(
  'ace/mode/json',
  await import('ace-builds/src-noconflict/mode-json')
)
ace.config.setModuleUrl(
  'ace/mode/json5',
  await import('ace-builds/src-noconflict/mode-json5')
)
ace.config.setModuleUrl(
  'ace/mode/jsoniq',
  await import('ace-builds/src-noconflict/mode-jsoniq')
)
ace.config.setModuleUrl(
  'ace/mode/jsp',
  await import('ace-builds/src-noconflict/mode-jsp')
)
ace.config.setModuleUrl(
  'ace/mode/jssm',
  await import('ace-builds/src-noconflict/mode-jssm')
)
ace.config.setModuleUrl(
  'ace/mode/jsx',
  await import('ace-builds/src-noconflict/mode-jsx')
)
ace.config.setModuleUrl(
  'ace/mode/julia',
  await import('ace-builds/src-noconflict/mode-julia')
)
ace.config.setModuleUrl(
  'ace/mode/kotlin',
  await import('ace-builds/src-noconflict/mode-kotlin')
)
ace.config.setModuleUrl(
  'ace/mode/latex',
  await import('ace-builds/src-noconflict/mode-latex')
)
ace.config.setModuleUrl(
  'ace/mode/latte',
  await import('ace-builds/src-noconflict/mode-latte')
)
ace.config.setModuleUrl(
  'ace/mode/less',
  await import('ace-builds/src-noconflict/mode-less')
)
ace.config.setModuleUrl(
  'ace/mode/liquid',
  await import('ace-builds/src-noconflict/mode-liquid')
)
ace.config.setModuleUrl(
  'ace/mode/lisp',
  await import('ace-builds/src-noconflict/mode-lisp')
)
ace.config.setModuleUrl(
  'ace/mode/livescript',
  await import('ace-builds/src-noconflict/mode-livescript')
)
ace.config.setModuleUrl(
  'ace/mode/logiql',
  await import('ace-builds/src-noconflict/mode-logiql')
)
ace.config.setModuleUrl(
  'ace/mode/logtalk',
  await import('ace-builds/src-noconflict/mode-logtalk')
)
ace.config.setModuleUrl(
  'ace/mode/lsl',
  await import('ace-builds/src-noconflict/mode-lsl')
)
ace.config.setModuleUrl(
  'ace/mode/lua',
  await import('ace-builds/src-noconflict/mode-lua')
)
ace.config.setModuleUrl(
  'ace/mode/luapage',
  await import('ace-builds/src-noconflict/mode-luapage')
)
ace.config.setModuleUrl(
  'ace/mode/lucene',
  await import('ace-builds/src-noconflict/mode-lucene')
)
ace.config.setModuleUrl(
  'ace/mode/makefile',
  await import('ace-builds/src-noconflict/mode-makefile')
)
ace.config.setModuleUrl(
  'ace/mode/markdown',
  await import('ace-builds/src-noconflict/mode-markdown')
)
ace.config.setModuleUrl(
  'ace/mode/mask',
  await import('ace-builds/src-noconflict/mode-mask')
)
ace.config.setModuleUrl(
  'ace/mode/matlab',
  await import('ace-builds/src-noconflict/mode-matlab')
)
ace.config.setModuleUrl(
  'ace/mode/maze',
  await import('ace-builds/src-noconflict/mode-maze')
)
ace.config.setModuleUrl(
  'ace/mode/mediawiki',
  await import('ace-builds/src-noconflict/mode-mediawiki')
)
ace.config.setModuleUrl(
  'ace/mode/mel',
  await import('ace-builds/src-noconflict/mode-mel')
)
ace.config.setModuleUrl(
  'ace/mode/mips',
  await import('ace-builds/src-noconflict/mode-mips')
)
ace.config.setModuleUrl(
  'ace/mode/mixal',
  await import('ace-builds/src-noconflict/mode-mixal')
)
ace.config.setModuleUrl(
  'ace/mode/mushcode',
  await import('ace-builds/src-noconflict/mode-mushcode')
)
ace.config.setModuleUrl(
  'ace/mode/mysql',
  await import('ace-builds/src-noconflict/mode-mysql')
)
ace.config.setModuleUrl(
  'ace/mode/nginx',
  await import('ace-builds/src-noconflict/mode-nginx')
)
ace.config.setModuleUrl(
  'ace/mode/nim',
  await import('ace-builds/src-noconflict/mode-nim')
)
ace.config.setModuleUrl(
  'ace/mode/nix',
  await import('ace-builds/src-noconflict/mode-nix')
)
ace.config.setModuleUrl(
  'ace/mode/nsis',
  await import('ace-builds/src-noconflict/mode-nsis')
)
ace.config.setModuleUrl(
  'ace/mode/nunjucks',
  await import('ace-builds/src-noconflict/mode-nunjucks')
)
ace.config.setModuleUrl(
  'ace/mode/objectivec',
  await import('ace-builds/src-noconflict/mode-objectivec')
)
ace.config.setModuleUrl(
  'ace/mode/ocaml',
  await import('ace-builds/src-noconflict/mode-ocaml')
)
ace.config.setModuleUrl(
  'ace/mode/pascal',
  await import('ace-builds/src-noconflict/mode-pascal')
)
ace.config.setModuleUrl(
  'ace/mode/perl',
  await import('ace-builds/src-noconflict/mode-perl')
)
ace.config.setModuleUrl(
  'ace/mode/pgsql',
  await import('ace-builds/src-noconflict/mode-pgsql')
)
ace.config.setModuleUrl(
  'ace/mode/php',
  await import('ace-builds/src-noconflict/mode-php')
)
ace.config.setModuleUrl(
  'ace/mode/php_laravel_blade',
  await import('ace-builds/src-noconflict/mode-php_laravel_blade')
)
ace.config.setModuleUrl(
  'ace/mode/pig',
  await import('ace-builds/src-noconflict/mode-pig')
)
ace.config.setModuleUrl(
  'ace/mode/plain_text',
  await import('ace-builds/src-noconflict/mode-plain_text')
)
ace.config.setModuleUrl(
  'ace/mode/powershell',
  await import('ace-builds/src-noconflict/mode-powershell')
)
ace.config.setModuleUrl(
  'ace/mode/praat',
  await import('ace-builds/src-noconflict/mode-praat')
)
ace.config.setModuleUrl(
  'ace/mode/prisma',
  await import('ace-builds/src-noconflict/mode-prisma')
)
ace.config.setModuleUrl(
  'ace/mode/prolog',
  await import('ace-builds/src-noconflict/mode-prolog')
)
ace.config.setModuleUrl(
  'ace/mode/properties',
  await import('ace-builds/src-noconflict/mode-properties')
)
ace.config.setModuleUrl(
  'ace/mode/protobuf',
  await import('ace-builds/src-noconflict/mode-protobuf')
)
ace.config.setModuleUrl(
  'ace/mode/puppet',
  await import('ace-builds/src-noconflict/mode-puppet')
)
ace.config.setModuleUrl(
  'ace/mode/python',
  await import('ace-builds/src-noconflict/mode-python')
)
ace.config.setModuleUrl(
  'ace/mode/qml',
  await import('ace-builds/src-noconflict/mode-qml')
)
ace.config.setModuleUrl(
  'ace/mode/r',
  await import('ace-builds/src-noconflict/mode-r')
)
ace.config.setModuleUrl(
  'ace/mode/raku',
  await import('ace-builds/src-noconflict/mode-raku')
)
ace.config.setModuleUrl(
  'ace/mode/razor',
  await import('ace-builds/src-noconflict/mode-razor')
)
ace.config.setModuleUrl(
  'ace/mode/rdoc',
  await import('ace-builds/src-noconflict/mode-rdoc')
)
ace.config.setModuleUrl(
  'ace/mode/red',
  await import('ace-builds/src-noconflict/mode-red')
)
ace.config.setModuleUrl(
  'ace/mode/redshift',
  await import('ace-builds/src-noconflict/mode-redshift')
)
ace.config.setModuleUrl(
  'ace/mode/rhtml',
  await import('ace-builds/src-noconflict/mode-rhtml')
)
ace.config.setModuleUrl(
  'ace/mode/rst',
  await import('ace-builds/src-noconflict/mode-rst')
)
ace.config.setModuleUrl(
  'ace/mode/ruby',
  await import('ace-builds/src-noconflict/mode-ruby')
)
ace.config.setModuleUrl(
  'ace/mode/rust',
  await import('ace-builds/src-noconflict/mode-rust')
)
ace.config.setModuleUrl(
  'ace/mode/sass',
  await import('ace-builds/src-noconflict/mode-sass')
)
ace.config.setModuleUrl(
  'ace/mode/scad',
  await import('ace-builds/src-noconflict/mode-scad')
)
ace.config.setModuleUrl(
  'ace/mode/scala',
  await import('ace-builds/src-noconflict/mode-scala')
)
ace.config.setModuleUrl(
  'ace/mode/scheme',
  await import('ace-builds/src-noconflict/mode-scheme')
)
ace.config.setModuleUrl(
  'ace/mode/scrypt',
  await import('ace-builds/src-noconflict/mode-scrypt')
)
ace.config.setModuleUrl(
  'ace/mode/scss',
  await import('ace-builds/src-noconflict/mode-scss')
)
ace.config.setModuleUrl(
  'ace/mode/sh',
  await import('ace-builds/src-noconflict/mode-sh')
)
ace.config.setModuleUrl(
  'ace/mode/sjs',
  await import('ace-builds/src-noconflict/mode-sjs')
)
ace.config.setModuleUrl(
  'ace/mode/slim',
  await import('ace-builds/src-noconflict/mode-slim')
)
ace.config.setModuleUrl(
  'ace/mode/smarty',
  await import('ace-builds/src-noconflict/mode-smarty')
)
ace.config.setModuleUrl(
  'ace/mode/smithy',
  await import('ace-builds/src-noconflict/mode-smithy')
)
ace.config.setModuleUrl(
  'ace/mode/snippets',
  await import('ace-builds/src-noconflict/mode-snippets')
)
ace.config.setModuleUrl(
  'ace/mode/soy_template',
  await import('ace-builds/src-noconflict/mode-soy_template')
)
ace.config.setModuleUrl(
  'ace/mode/space',
  await import('ace-builds/src-noconflict/mode-space')
)
ace.config.setModuleUrl(
  'ace/mode/sparql',
  await import('ace-builds/src-noconflict/mode-sparql')
)
ace.config.setModuleUrl(
  'ace/mode/sql',
  await import('ace-builds/src-noconflict/mode-sql')
)
ace.config.setModuleUrl(
  'ace/mode/sqlserver',
  await import('ace-builds/src-noconflict/mode-sqlserver')
)
ace.config.setModuleUrl(
  'ace/mode/stylus',
  await import('ace-builds/src-noconflict/mode-stylus')
)
ace.config.setModuleUrl(
  'ace/mode/svg',
  await import('ace-builds/src-noconflict/mode-svg')
)
ace.config.setModuleUrl(
  'ace/mode/swift',
  await import('ace-builds/src-noconflict/mode-swift')
)
ace.config.setModuleUrl(
  'ace/mode/tcl',
  await import('ace-builds/src-noconflict/mode-tcl')
)
ace.config.setModuleUrl(
  'ace/mode/terraform',
  await import('ace-builds/src-noconflict/mode-terraform')
)
ace.config.setModuleUrl(
  'ace/mode/tex',
  await import('ace-builds/src-noconflict/mode-tex')
)
ace.config.setModuleUrl(
  'ace/mode/text',
  await import('ace-builds/src-noconflict/mode-text')
)
ace.config.setModuleUrl(
  'ace/mode/textile',
  await import('ace-builds/src-noconflict/mode-textile')
)
ace.config.setModuleUrl(
  'ace/mode/toml',
  await import('ace-builds/src-noconflict/mode-toml')
)
ace.config.setModuleUrl(
  'ace/mode/tsx',
  await import('ace-builds/src-noconflict/mode-tsx')
)
ace.config.setModuleUrl(
  'ace/mode/turtle',
  await import('ace-builds/src-noconflict/mode-turtle')
)
ace.config.setModuleUrl(
  'ace/mode/twig',
  await import('ace-builds/src-noconflict/mode-twig')
)
ace.config.setModuleUrl(
  'ace/mode/typescript',
  await import('ace-builds/src-noconflict/mode-typescript')
)
ace.config.setModuleUrl(
  'ace/mode/vala',
  await import('ace-builds/src-noconflict/mode-vala')
)
ace.config.setModuleUrl(
  'ace/mode/vbscript',
  await import('ace-builds/src-noconflict/mode-vbscript')
)
ace.config.setModuleUrl(
  'ace/mode/velocity',
  await import('ace-builds/src-noconflict/mode-velocity')
)
ace.config.setModuleUrl(
  'ace/mode/verilog',
  await import('ace-builds/src-noconflict/mode-verilog')
)
ace.config.setModuleUrl(
  'ace/mode/vhdl',
  await import('ace-builds/src-noconflict/mode-vhdl')
)
ace.config.setModuleUrl(
  'ace/mode/visualforce',
  await import('ace-builds/src-noconflict/mode-visualforce')
)
ace.config.setModuleUrl(
  'ace/mode/wollok',
  await import('ace-builds/src-noconflict/mode-wollok')
)
ace.config.setModuleUrl(
  'ace/mode/xml',
  await import('ace-builds/src-noconflict/mode-xml')
)
ace.config.setModuleUrl(
  'ace/mode/xquery',
  await import('ace-builds/src-noconflict/mode-xquery')
)
ace.config.setModuleUrl(
  'ace/mode/yaml',
  await import('ace-builds/src-noconflict/mode-yaml')
)
ace.config.setModuleUrl(
  'ace/mode/zeek',
  await import('ace-builds/src-noconflict/mode-zeek')
)

ace.config.setModuleUrl(
  'ace/theme/ambiance',
  await import('ace-builds/src-noconflict/theme-ambiance')
)
ace.config.setModuleUrl(
  'ace/theme/chaos',
  await import('ace-builds/src-noconflict/theme-chaos')
)
ace.config.setModuleUrl(
  'ace/theme/chrome',
  await import('ace-builds/src-noconflict/theme-chrome')
)
ace.config.setModuleUrl(
  'ace/theme/clouds',
  await import('ace-builds/src-noconflict/theme-clouds')
)
ace.config.setModuleUrl(
  'ace/theme/clouds_midnight',
  await import('ace-builds/src-noconflict/theme-clouds_midnight')
)
ace.config.setModuleUrl(
  'ace/theme/cobalt',
  await import('ace-builds/src-noconflict/theme-cobalt')
)
ace.config.setModuleUrl(
  'ace/theme/crimson_editor',
  await import('ace-builds/src-noconflict/theme-crimson_editor')
)
ace.config.setModuleUrl(
  'ace/theme/dawn',
  await import('ace-builds/src-noconflict/theme-dawn')
)
ace.config.setModuleUrl(
  'ace/theme/dracula',
  await import('ace-builds/src-noconflict/theme-dracula')
)
ace.config.setModuleUrl(
  'ace/theme/dreamweaver',
  await import('ace-builds/src-noconflict/theme-dreamweaver')
)
ace.config.setModuleUrl(
  'ace/theme/eclipse',
  await import('ace-builds/src-noconflict/theme-eclipse')
)
ace.config.setModuleUrl(
  'ace/theme/github',
  await import('ace-builds/src-noconflict/theme-github')
)
ace.config.setModuleUrl(
  'ace/theme/gob',
  await import('ace-builds/src-noconflict/theme-gob')
)
ace.config.setModuleUrl(
  'ace/theme/gruvbox',
  await import('ace-builds/src-noconflict/theme-gruvbox')
)
ace.config.setModuleUrl(
  'ace/theme/idle_fingers',
  await import('ace-builds/src-noconflict/theme-idle_fingers')
)
ace.config.setModuleUrl(
  'ace/theme/iplastic',
  await import('ace-builds/src-noconflict/theme-iplastic')
)
ace.config.setModuleUrl(
  'ace/theme/katzenmilch',
  await import('ace-builds/src-noconflict/theme-katzenmilch')
)
ace.config.setModuleUrl(
  'ace/theme/kr_theme',
  await import('ace-builds/src-noconflict/theme-kr_theme')
)
ace.config.setModuleUrl(
  'ace/theme/kuroir',
  await import('ace-builds/src-noconflict/theme-kuroir')
)
ace.config.setModuleUrl(
  'ace/theme/merbivore',
  await import('ace-builds/src-noconflict/theme-merbivore')
)
ace.config.setModuleUrl(
  'ace/theme/merbivore_soft',
  await import('ace-builds/src-noconflict/theme-merbivore_soft')
)
ace.config.setModuleUrl(
  'ace/theme/monokai',
  await import('ace-builds/src-noconflict/theme-monokai')
)
ace.config.setModuleUrl(
  'ace/theme/mono_industrial',
  await import('ace-builds/src-noconflict/theme-mono_industrial')
)
ace.config.setModuleUrl(
  'ace/theme/nord_dark',
  await import('ace-builds/src-noconflict/theme-nord_dark')
)
ace.config.setModuleUrl(
  'ace/theme/one_dark',
  await import('ace-builds/src-noconflict/theme-one_dark')
)
ace.config.setModuleUrl(
  'ace/theme/pastel_on_dark',
  await import('ace-builds/src-noconflict/theme-pastel_on_dark')
)
ace.config.setModuleUrl(
  'ace/theme/solarized_dark',
  await import('ace-builds/src-noconflict/theme-solarized_dark')
)
ace.config.setModuleUrl(
  'ace/theme/solarized_light',
  await import('ace-builds/src-noconflict/theme-solarized_light')
)
ace.config.setModuleUrl(
  'ace/theme/sqlserver',
  await import('ace-builds/src-noconflict/theme-sqlserver')
)
ace.config.setModuleUrl(
  'ace/theme/terminal',
  await import('ace-builds/src-noconflict/theme-terminal')
)
ace.config.setModuleUrl(
  'ace/theme/textmate',
  await import('ace-builds/src-noconflict/theme-textmate')
)
ace.config.setModuleUrl(
  'ace/theme/tomorrow',
  await import('ace-builds/src-noconflict/theme-tomorrow')
)
ace.config.setModuleUrl(
  'ace/theme/tomorrow_night',
  await import('ace-builds/src-noconflict/theme-tomorrow_night')
)
ace.config.setModuleUrl(
  'ace/theme/tomorrow_night_blue',
  await import('ace-builds/src-noconflict/theme-tomorrow_night_blue')
)
ace.config.setModuleUrl(
  'ace/theme/tomorrow_night_bright',
  await import('ace-builds/src-noconflict/theme-tomorrow_night_bright')
)
ace.config.setModuleUrl(
  'ace/theme/tomorrow_night_eighties',
  await import('ace-builds/src-noconflict/theme-tomorrow_night_eighties')
)
ace.config.setModuleUrl(
  'ace/theme/twilight',
  await import('ace-builds/src-noconflict/theme-twilight')
)
ace.config.setModuleUrl(
  'ace/theme/vibrant_ink',
  await import('ace-builds/src-noconflict/theme-vibrant_ink')
)
ace.config.setModuleUrl(
  'ace/theme/xcode',
  await import('ace-builds/src-noconflict/theme-xcode')
)
