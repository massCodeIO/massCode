import fs from 'fs-extra'
import { join } from 'path'
import Handlebars from 'handlebars'
import { languages } from '../src/renderer/components/editor/languages'

const sorted = languages.sort((a, b) =>
  a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1
)

const source = `# Languages list

This is a list of language that supports in massCode.

{{#each sorted}}
- {{this.name}}
{{/each}}
`

const template = Handlebars.compile(source)
const result = template({ sorted })

fs.writeFile(
  join(__dirname, '../../src/renderer/components/editor/README.md'),
  result,
  { encoding: 'utf-8' }
)

console.log(`Total languages: ${languages.length}`)
