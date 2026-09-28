import type { Language, LanguageOption } from '../types'
import { codeLanguages } from '~/shared/codeLanguages'

export const languages: LanguageOption[] = [
  {
    ...codeLanguages[0],
    grammar: () => import('./textmate/abap.tmLanguage.json'),
    scopeName: 'source.abap',
  },
  // Возможно несоответствие
  {
    ...codeLanguages[1],
    grammar: () => import('./textmate/abc.tmLanguage.json'),
    scopeName: 'text.abcnotation',
  },
  {
    ...codeLanguages[2],
    grammar: () => import('./textmate/actionscript-3.tmLanguage.json'),
    scopeName: 'source.actionscript.3',
  },
  {
    ...codeLanguages[3],
    grammar: () => import('./textmate/ada.tmLanguage.json'),
    scopeName: 'source.ada',
  },
  {
    ...codeLanguages[4],
    grammar: () => import('./textmate/alda.tmLanguage.json'),
    scopeName: 'source.alda',
  },
  {
    ...codeLanguages[5],
    grammar: () => import('./textmate/apache.tmLanguage.json'),
    scopeName: 'source.apacheconf',
  },
  {
    ...codeLanguages[6],
    grammar: () => import('./textmate/apex.tmLanguage.json'),
    scopeName: 'source.apex',
  },
  {
    ...codeLanguages[7],
    grammar: () => import('./textmate/applescript.tmLanguage.json'),
    scopeName: 'source.applescript',
  },
  {
    ...codeLanguages[8],
    grammar: () => import('./textmate/asciidoctor.tmLanguage.json'),
    scopeName: 'text.asciidoc',
  },
  {
    ...codeLanguages[9],
    grammar: () => import('./textmate/asl.tmLanguage.json'),
    scopeName: 'source.asl',
  },
  {
    ...codeLanguages[10],
    grammar: () => import('./textmate/asp-vb-net.tmlanguage.json'),
    scopeName: 'source.asp.vb.net',
  },
  {
    ...codeLanguages[11],
    grammar: () => import('./textmate/asm.tmLanguage.json'),
    scopeName: 'source.asm',
  },
  {
    ...codeLanguages[12],
    grammar: () => import('./textmate/autohotkey.tmLanguage.json'),
    scopeName: 'source.ahk',
  },
  {
    ...codeLanguages[13],
    grammar: () => import('./textmate/shell-unix-bash.tmLanguage.json'),
    scopeName: 'source.shell',
  },
  {
    ...codeLanguages[14],
    grammar: () => import('./textmate/batchfile.tmLanguage.json'),
    scopeName: 'source.batchfile',
  },
  {
    ...codeLanguages[15],
    grammar: () => import('./textmate/bicep.tmLanguage.json'),
    scopeName: 'source.bicep',
  },
  {
    ...codeLanguages[16],
    grammar: () => import('./textmate/cpp.tmLanguage.json'),
    scopeName: 'source.cpp',
  },
  {
    ...codeLanguages[17],
    grammar: () => import('./textmate/csharp.tmLanguage.json'),
    scopeName: 'source.cs',
  },
  {
    ...codeLanguages[18],
    grammar: () => import('./textmate/cirru.tmLanguage.json'),
    scopeName: 'source.cirru',
  },
  {
    ...codeLanguages[19],
    grammar: () => import('./textmate/clojure.tmLanguage.json'),
    scopeName: 'source.clojure',
  },
  {
    ...codeLanguages[20],
    grammar: () => import('./textmate/cobol.tmLanguage.json'),
    scopeName: 'source.cobol',
  },
  {
    ...codeLanguages[21],
    grammar: () => import('./textmate/coffee.tmLanguage.json'),
    scopeName: 'source.coffee',
  },
  {
    ...codeLanguages[22],
    grammar: () => import('./textmate/coldfusion.tmLanguage.json'),
    scopeName: 'text.cfml.basic',
  },
  {
    ...codeLanguages[23],
    grammar: () => import('./textmate/crystal.tmLanguage.json'),
    scopeName: 'source.crystal',
  },
  {
    ...codeLanguages[24],
    grammar: () => import('./textmate/csound.tmLanguage.json'),
    scopeName: 'source.csound',
  },
  {
    ...codeLanguages[25],
    grammar: () => import('./textmate/csound-document.tmLanguage.json'),
    scopeName: 'source.csound-document',
  },
  {
    ...codeLanguages[26],
    grammar: () => import('./textmate/csound-score.tmLanguage.json'),
    scopeName: 'source.csound-score',
  },
  {
    ...codeLanguages[27],
    grammar: () => import('./textmate/css.tmLanguage.json'),
    scopeName: 'source.css',
  },
  {
    ...codeLanguages[28],
    grammar: () => import('./textmate/curly.tmLanguage.json'),
    scopeName: 'text.html.curly',
  },
  {
    ...codeLanguages[29],
    grammar: () => import('./textmate/d.tmLanguage.json'),
    scopeName: 'source.d',
  },
  {
    ...codeLanguages[30],
    grammar: () => import('./textmate/dart.tmLanguage.json'),
    scopeName: 'source.dart',
  },
  {
    ...codeLanguages[31],
    grammar: () => import('./textmate/diff.tmLanguage.json'),
    scopeName: 'source.diff',
  },
  {
    ...codeLanguages[32],
    grammar: () => import('./textmate/django.tmLanguage.json'),
    scopeName: 'source.python.django',
  },
  {
    ...codeLanguages[33],
    grammar: () => import('./textmate/docker.tmLanguage.json'),
    scopeName: 'source.dockerfile',
  },
  {
    ...codeLanguages[34],
    grammar: () => import('./textmate/dot.tmLanguage.json'),
    scopeName: 'source.dot',
  },
  {
    ...codeLanguages[35],
    grammar: () => import('./textmate/drools.tmLanguage.json'),
    scopeName: 'source.drools',
  },
  {
    ...codeLanguages[36],
    grammar: () => import('./textmate/edifact.tmLanguage.json'),
    scopeName: 'text.plain.edifact',
  },
  {
    ...codeLanguages[37],
    grammar: () => import('./textmate/eiffel.tmLanguage.json'),
    scopeName: 'source.eiffel',
  },
  {
    ...codeLanguages[38],
    grammar: () => import('./textmate/ejs.tmLanguage.json'),
    scopeName: 'text.html.js',
  },
  {
    ...codeLanguages[39],
    grammar: () => import('./textmate/elixir.tmLanguage.json'),
    scopeName: 'source.elixir',
  },
  {
    ...codeLanguages[40],
    grammar: () => import('./textmate/elm.tmLanguage.json'),
    scopeName: 'source.elm',
  },
  {
    ...codeLanguages[41],
    grammar: () => import('./textmate/erlang.tmLanguage.json'),
    scopeName: 'source.erlang',
  },
  {
    ...codeLanguages[42],
    grammar: () => import('./textmate/forth.tmLanguage.json'),
    scopeName: 'source.forth',
  },
  {
    ...codeLanguages[43],
    grammar: () => import('./textmate/fortran.tmLanguage.json'),
    scopeName: 'source.fortran',
  },
  {
    ...codeLanguages[44],
    grammar: () => import('./textmate/fsharp.tmLanguage.json'),
    scopeName: 'source.fsharp',
  },
  {
    ...codeLanguages[45],
    grammar: () => import('./textmate/gcode.tmLanguage.json'),
    scopeName: 'source.gcode',
  },
  {
    ...codeLanguages[46],
    grammar: () => import('./textmate/gherkin.tmLanguage.json'),
    scopeName: 'text.gherkin.feature',
  },
  {
    ...codeLanguages[47],
    grammar: () => import('./textmate/gitignore.tmLanguage.json'),
    scopeName: 'source.gitignore',
  },
  {
    ...codeLanguages[48],
    grammar: () => import('./textmate/glsl.tmLanguage.json'),
    scopeName: 'source.glsl',
  },
  {
    ...codeLanguages[49],
    grammar: () => import('./textmate/go.tmLanguage.json'),
    scopeName: 'source.go',
  },
  {
    ...codeLanguages[50],
    grammar: () => import('./textmate/graphql.tmLanguage.json'),
    scopeName: 'source.graphql',
  },
  {
    ...codeLanguages[51],
    grammar: () => import('./textmate/groovy.tmLanguage.json'),
    scopeName: 'source.groovy',
  },
  {
    ...codeLanguages[52],
    grammar: () => import('./textmate/haml.tmLanguage.json'),
    scopeName: 'text.haml',
  },
  {
    ...codeLanguages[53],
    grammar: () => import('./textmate/handlebars.tmLanguage.json'),
    scopeName: 'text.html.handlebars',
  },
  // Возможно несоответствие
  {
    ...codeLanguages[54],
    grammar: () => import('./textmate/haskell-cabal.tmLanguage.json'),
    scopeName: 'source.cabal',
  },
  {
    ...codeLanguages[55],
    grammar: () => import('./textmate/haskell.tmLanguage.json'),
    scopeName: 'source.haskell',
  },
  {
    ...codeLanguages[56],
    grammar: () => import('./textmate/haxe.tmLanguage.json'),
    scopeName: 'source.hx',
  },
  {
    ...codeLanguages[57],
    grammar: () => import('./textmate/hjson.tmLanguage.json'),
    scopeName: 'source.hjson',
  },
  {
    ...codeLanguages[58],
    grammar: () => import('./textmate/html-elixir.tmLanguage.json'),
    scopeName: 'text.html.elixir',
  },
  {
    ...codeLanguages[59],
    grammar: () => import('./textmate/html-ruby.tmLanguage.json'),
    scopeName: 'text.html.erb',
  },
  {
    ...codeLanguages[60],
    grammar: () => import('./textmate/html.tmLanguage.json'),
    scopeName: 'text.html.basic',
  },
  {
    ...codeLanguages[61],
    grammar: () => import('./textmate/ini.tmLanguage.json'),
    scopeName: 'source.ini',
  },
  {
    ...codeLanguages[62],
    grammar: () => import('./textmate/io.tmLanguage.json'),
    scopeName: 'source.io',
  },
  {
    ...codeLanguages[63],
    grammar: () => import('./textmate/java.tmLanguage.json'),
    scopeName: 'source.java',
  },
  {
    ...codeLanguages[64],
    grammar: () => import('./textmate/javascript.tmLanguage.json'),
    scopeName: 'source.js',
  },
  {
    ...codeLanguages[65],
    grammar: () => import('./textmate/json.tmLanguage.json'),
    scopeName: 'source.json',
  },
  {
    ...codeLanguages[66],
    grammar: () => import('./textmate/json5.tmLanguage.json'),
    scopeName: 'source.json5',
  },
  {
    ...codeLanguages[67],
    grammar: () => import('./textmate/jsoniq.tmLanguage.json'),
    scopeName: 'source.jsoniq',
  },
  {
    ...codeLanguages[68],
    grammar: () => import('./textmate/jsp.tmLanguage.json'),
    scopeName: 'text.html.jsp',
  },
  // TODO: сделать общими стилизованые (.jsx, tsx) грамматики
  {
    ...codeLanguages[69],
    grammar: () => import('./textmate/jsx.tmLanguage.json'),
    scopeName: 'source.jsx',
  },
  {
    ...codeLanguages[70],
    grammar: () => import('./textmate/julia.tmLanguage.json'),
    scopeName: 'source.julia',
  },
  {
    ...codeLanguages[71],
    grammar: () => import('./textmate/kotlin.tmLanguage.json'),
    scopeName: 'source.kotlin',
  },
  {
    ...codeLanguages[72],
    grammar: () => import('./textmate/kusto.tmLanguage.json'),
    scopeName: 'source.kusto',
  },
  {
    ...codeLanguages[73],
    grammar: () => import('./textmate/latex.tmLanguage.json'),
    scopeName: 'text.tex.latex',
  },
  {
    ...codeLanguages[74],
    grammar: () => import('./textmate/latte.tmLanguage.json'),
    scopeName: 'source.latte',
  },
  {
    ...codeLanguages[75],
    grammar: () => import('./textmate/less.tmLanguage.json'),
    scopeName: 'source.css.less',
  },
  {
    ...codeLanguages[76],
    grammar: () => import('./textmate/liquid.tmLanguage.json'),
    scopeName: 'source.liquid',
  },
  {
    ...codeLanguages[77],
    grammar: () => import('./textmate/lisp.tmLanguage.json'),
    scopeName: 'source.lisp',
  },
  {
    ...codeLanguages[78],
    grammar: () => import('./textmate/livescript.tmLanguage.json'),
    scopeName: 'source.livescript',
  },
  {
    ...codeLanguages[79],
    grammar: () => import('./textmate/lsl.tmLanguage.json'),
    scopeName: 'source.lsl',
  },
  {
    ...codeLanguages[80],
    grammar: () => import('./textmate/lua.tmLanguage.json'),
    scopeName: 'source.lua',
  },
  {
    ...codeLanguages[81],
    grammar: () => import('./textmate/make.tmLanguage.json'),
    scopeName: 'source.makefile',
  },
  {
    ...codeLanguages[82],
    grammar: () => import('./textmate/markdown.tmLanguage.json'),
    scopeName: 'text.html.markdown',
  },
  {
    ...codeLanguages[83],
    grammar: () => import('./textmate/mask.tmLanguage.json'),
    scopeName: 'source.mask',
  },
  {
    ...codeLanguages[84],
    grammar: () => import('./textmate/matlab.tmLanguage.json'),
    scopeName: 'source.matlab',
  },
  {
    ...codeLanguages[85],
    grammar: () => import('./textmate/mediawiki.tmLanguage.json'),
    scopeName: 'text.html.mediawiki',
  },
  {
    ...codeLanguages[86],
    grammar: () => import('./textmate/mel.tmLanguage.json'),
    scopeName: 'source.mel',
  },
  {
    ...codeLanguages[87],
    grammar: () => import('./textmate/mikrotik.tmLanguage.json'),
    scopeName: 'source.mikrotik-script',
  },
  {
    ...codeLanguages[88],
    grammar: () => import('./textmate/mips.tmLanguage.json'),
    scopeName: 'source.mips',
  },
  {
    ...codeLanguages[89],
    grammar: () => import('./textmate/mysql.tmLanguage.json'),
    scopeName: 'source.sql.mysql',
  },
  {
    ...codeLanguages[90],
    grammar: () => import('./textmate/nginx.tmLanguage.json'),
    scopeName: 'source.nginx',
  },
  {
    ...codeLanguages[91],
    grammar: () => import('./textmate/nim.tmLanguage.json'),
    scopeName: 'source.nim',
  },
  {
    ...codeLanguages[92],
    grammar: () => import('./textmate/nix.tmLanguage.json'),
    scopeName: 'source.nix',
  },
  {
    ...codeLanguages[93],
    grammar: () => import('./textmate/nu.tmLanguage.json'),
    scopeName: 'source.nushell',
  },
  {
    ...codeLanguages[94],
    grammar: () => import('./textmate/nsis.tmLanguage.json'),
    scopeName: 'source.nsis',
  },
  {
    ...codeLanguages[95],
    grammar: () => import('./textmate/nunjucks.tmLanguage.json'),
    scopeName: 'text.html.nunjucks',
  },
  {
    ...codeLanguages[96],
    grammar: () => import('./textmate/objective-c.tmLanguage.json'),
    scopeName: 'source.objc',
  },
  {
    ...codeLanguages[97],
    grammar: () => import('./textmate/ocaml.tmLanguage.json'),
    scopeName: 'source.ocaml',
  },
  {
    ...codeLanguages[98],
    grammar: () => import('./textmate/oeabl.tmLanguage.json'),
    scopeName: 'source.oeabl',
  },
  {
    ...codeLanguages[99],
    grammar: () => import('./textmate/glsl.tmLanguage.json'),
    scopeName: 'source.glsl',
  },
  {
    ...codeLanguages[100],
    grammar: () => import('./textmate/pascal.tmLanguage.json'),
    scopeName: 'source.pascal',
  },
  {
    ...codeLanguages[101],
    grammar: () => import('./textmate/perl.tmLanguage.json'),
    scopeName: 'source.perl',
  },
  {
    ...codeLanguages[102],
    grammar: () => import('./textmate/pgsql.tmLanguage.json'),
    scopeName: 'source.pgsql',
  },
  {
    ...codeLanguages[103],
    grammar: () => import('./textmate/php-blade.tmLanguage.json'),
    scopeName: 'text.html.php.blade',
  },
  {
    ...codeLanguages[104],
    grammar: () => import('./textmate/php.tmLanguage.json'),
    scopeName: 'source.php',
  },
  {
    ...codeLanguages[105],
    grammar: () => import('./textmate/pig.tmLanguage.json'),
    scopeName: 'source.pig',
  },
  {
    ...codeLanguages[106],
    grammar: () => import('./textmate/plain-text.tmLanguage.json'),
    scopeName: 'text.plain',
  },
  {
    ...codeLanguages[107],
    grammar: () => import('./textmate/powershell.tmLanguage.json'),
    scopeName: 'source.powershell',
  },
  {
    ...codeLanguages[108],
    grammar: () => import('./textmate/powerquery.tmLanguage.json'),
    scopeName: 'source.powerquery',
  },
  {
    ...codeLanguages[109],
    grammar: () => import('./textmate/praat.tmLanguage.json'),
    scopeName: 'source.praat',
  },
  {
    ...codeLanguages[110],
    grammar: () => import('./textmate/prisma.tmLanguage.json'),
    scopeName: 'source.prisma',
  },
  {
    ...codeLanguages[111],
    grammar: () => import('./textmate/prolog.tmLanguage.json'),
    scopeName: 'source.prolog',
  },
  {
    ...codeLanguages[112],
    grammar: () => import('./textmate/properties.tmLanguage.json'),
    scopeName: 'source.tm-properties',
  },
  {
    ...codeLanguages[113],
    grammar: () => import('./textmate/protobuf.tmLanguage.json'),
    scopeName: 'source.proto',
  },
  {
    ...codeLanguages[114],
    grammar: () => import('./textmate/pug.tmLanguage.json'),
    scopeName: 'text.pug',
  },
  {
    ...codeLanguages[115],
    grammar: () => import('./textmate/puppet.tmLanguage.json'),
    scopeName: 'source.puppet',
  },
  {
    ...codeLanguages[116],
    grammar: () => import('./textmate/python.tmLanguage.json'),
    scopeName: 'source.python',
  },
  {
    ...codeLanguages[117],
    grammar: () => import('./textmate/qml.tmLanguage.json'),
    scopeName: 'source.qml',
  },
  {
    ...codeLanguages[118],
    grammar: () => import('./textmate/r.tmLanguage.json'),
    scopeName: 'source.r',
  },
  {
    ...codeLanguages[119],
    grammar: () => import('./textmate/raku.tmLanguage.json'),
    scopeName: 'source.perl.6',
  },
  {
    ...codeLanguages[120],
    grammar: () => import('./textmate/razor.tmLanguage.json'),
    scopeName: 'text.aspnetcorerazor',
  },
  {
    ...codeLanguages[121],
    grammar: () => import('./textmate/red.tmLanguage.json'),
    scopeName: 'source.red',
  },
  {
    ...codeLanguages[122],
    grammar: () => import('./textmate/regexp.tmLanguage.json'),
    scopeName: 'source.regexp',
  },
  {
    ...codeLanguages[123],
    grammar: () => import('./textmate/rst.tmLanguage.json'),
    scopeName: 'source.rst',
  },
  {
    ...codeLanguages[124],
    grammar: () => import('./textmate/ruby.tmLanguage.json'),
    scopeName: 'source.ruby',
  },
  {
    ...codeLanguages[125],
    grammar: () => import('./textmate/rust.tmLanguage.json'),
    scopeName: 'source.rust',
  },
  {
    ...codeLanguages[126],
    grammar: () => import('./textmate/sas.tmLanguage.json'),
    scopeName: 'source.sas',
  },
  {
    ...codeLanguages[127],
    grammar: () => import('./textmate/sass.tmLanguage.json'),
    scopeName: 'source.sass',
  },
  {
    ...codeLanguages[128],
    grammar: () => import('./textmate/scad.tmLanguage.json'),
    scopeName: 'source.scad',
  },
  {
    ...codeLanguages[129],
    grammar: () => import('./textmate/scala.tmLanguage.json'),
    scopeName: 'source.scala',
  },
  {
    ...codeLanguages[130],
    grammar: () => import('./textmate/scheme.tmLanguage.json'),
    scopeName: 'source.scheme',
  },
  {
    ...codeLanguages[131],
    grammar: () => import('./textmate/scrypt.tmLanguage.json'),
    scopeName: 'source.scrypt',
  },
  {
    ...codeLanguages[132],
    grammar: () => import('./textmate/scss.tmLanguage.json'),
    scopeName: 'source.css.scss',
  },
  {
    ...codeLanguages[133],
    grammar: () => import('./textmate/sjs.tmLanguage.json'),
    scopeName: 'source.sjs',
  },
  {
    ...codeLanguages[134],
    grammar: () => import('./textmate/slim.tmLanguage.json'),
    scopeName: 'text.slim',
  },
  {
    ...codeLanguages[135],
    grammar: () => import('./textmate/smalltalk.tmLanguage.json'),
    scopeName: 'source.smalltalk',
  },
  {
    ...codeLanguages[136],
    grammar: () => import('./textmate/smarty.tmLanguage.json'),
    scopeName: 'source.smarty',
  },
  {
    ...codeLanguages[137],
    grammar: () => import('./textmate/smithy.tmLanguage.json'),
    scopeName: 'source.smithy',
  },
  {
    ...codeLanguages[138],
    grammar: () => import('./textmate/solidity.tmLanguage.json'),
    scopeName: 'source.solidity',
  },
  {
    ...codeLanguages[139],
    grammar: () => import('./textmate/soytemplate.tmLanguage.json'),
    scopeName: 'source.soy',
  },
  {
    ...codeLanguages[140],
    grammar: () => import('./textmate/sql.tmLanguage.json'),
    scopeName: 'source.sql',
  },
  {
    ...codeLanguages[141],
    grammar: () => import('./textmate/sql.tmLanguage.json'),
    scopeName: 'source.sqlserver',
  },
  {
    ...codeLanguages[142],
    grammar: () => import('./textmate/structuredText.tmLanguage.json'),
    scopeName: 'source.st',
  },
  {
    ...codeLanguages[143],
    grammar: () => import('./textmate/less.tmLanguage.json'),
    scopeName: 'source.stylus',
  },
  {
    ...codeLanguages[144],
    grammar: () => import('./textmate/svg.tmLanguage.json'),
    scopeName: 'text.xml.svg',
  },
  {
    ...codeLanguages[145],
    grammar: () => import('./textmate/swift.tmLanguage.json'),
    scopeName: 'source.swift',
  },
  {
    ...codeLanguages[146],
    grammar: () => import('./textmate/tcl.tmLanguage.json'),
    scopeName: 'source.tcl',
  },
  {
    ...codeLanguages[147],
    grammar: () => import('./textmate/terraform.tmLanguage.json'),
    scopeName: 'source.terraform',
  },
  {
    ...codeLanguages[148],
    grammar: () => import('./textmate/tex.tmLanguage.json'),
    scopeName: 'text.tex',
  },
  {
    ...codeLanguages[149],
    grammar: () => import('./textmate/textile.tmLanguage.json'),
    scopeName: 'text.html.textile',
  },
  {
    ...codeLanguages[150],
    grammar: () => import('./textmate/toml.tmLanguage.json'),
    scopeName: 'source.toml',
  },
  {
    ...codeLanguages[151],
    grammar: () => import('./textmate/tsx.tmLanguage.json'),
    scopeName: 'source.tsx',
  },
  {
    ...codeLanguages[152],
    grammar: () => import('./textmate/twig.tmLanguage.json'),
    scopeName: 'text.html.twig',
  },
  {
    ...codeLanguages[153],
    grammar: () => import('./textmate/typescript.tmLanguage.json'),
    scopeName: 'source.ts',
  },
  {
    ...codeLanguages[154],
    grammar: () => import('./textmate/vala.tmLanguage.json'),
    scopeName: 'source.vala',
  },
  {
    ...codeLanguages[155],
    grammar: () => import('./textmate/velocity.tmLanguage.json'),
    scopeName: 'text.velocity',
  },
  {
    ...codeLanguages[156],
    grammar: () => import('./textmate/systemverilog.tmLanguage.json'),
    scopeName: 'source.systemverilog',
  },
  {
    ...codeLanguages[157],
    grammar: () => import('./textmate/vhdl.tmLanguage.json'),
    scopeName: 'source.vhdl',
  },
  {
    ...codeLanguages[158],
    grammar: () => import('./textmate/visualforce.tmLanguage.json'),
    scopeName: 'text.visualforce.markup',
  },
  {
    ...codeLanguages[159],
    grammar: () => import('./textmate/vue.tmLanguage.json'),
    scopeName: 'text.html.vue',
  },
  {
    ...codeLanguages[160],
    grammar: () => import('./textmate/wollok.tmLanguage.json'),
    scopeName: 'source.wollok',
  },
  {
    ...codeLanguages[161],
    grammar: () => import('./textmate/xml.tmLanguage.json'),
    scopeName: 'text.xml',
  },
  {
    ...codeLanguages[162],
    grammar: () => import('./textmate/xsl.tmLanguage.json'),
    scopeName: 'text.xml.xsl',
  },
  {
    ...codeLanguages[163],
    grammar: () => import('./textmate/xquery.tmLanguage.json'),
    scopeName: 'source.xquery',
  },
  {
    ...codeLanguages[164],
    grammar: () => import('./textmate/yaml.tmLanguage.json'),
    scopeName: 'source.yaml',
  },
  {
    ...codeLanguages[165],
    grammar: () => import('./textmate/zeek.tmLanguage.json'),
    scopeName: 'source.zeek',
  },
]

// Маппинг с версии v1
export const oldLanguageMap: Record<any, Language> = {
  'azcli': 'plain_text',
  'bat': 'sh',
  'cameligo': 'plain_text',
  'coffeescript': 'coffee',
  'c': 'c_cpp',
  'csp': 'plain_text',
  'go': 'golang',
  'graphql': 'graphqlschema',
  'msdax': 'plain_text',
  'objective-c': 'objectivec',
  'pascaligo': 'plain_text',
  'postiats': 'plain_text',
  'pug': 'jade',
  'redis': 'plain_text',
  'sb': 'plain_text',
  'shell': 'sh',
  'sol': 'plain_text',
  'aes': 'plain_text',
  'st': 'st',
  'vb': 'vbscript',
}
