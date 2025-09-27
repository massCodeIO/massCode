import type { GrammarOption, Language } from '../types'
import { activateLanguage, addGrammar } from 'codemirror-textmate'
import { auxGrammars } from './auxiliary-grammars'
import { languages } from './languages'

export async function loadGrammars() {
  const grammars: Record<string, GrammarOption> = {}

  languages
    .filter(i => i.grammar)
    .forEach(async (i) => {
      if (!i.scopeName || !i.grammar)
        return

      grammars[i.scopeName] = {
        grammar: i.grammar,
        language: i.value,
        priority: 'defer',
      }
    })

  auxGrammars.forEach((i) => {
    grammars[i.source] = {
      grammar: i.grammar,
      language: i.language as Language,
      priority: 'defer',
    }
  })

  await Promise.all(
    Object.keys(grammars).map(async (scopeName) => {
      const { grammar, language, priority } = grammars[scopeName]
      const { default: grammarDoc } = await grammar()

      try {
        addGrammar(scopeName, grammarDoc)
        if (language) {
          const prom = activateLanguage(scopeName, language, priority)

          if (priority === 'now') {
            await prom
          }
        }
      }
      catch (err) {
        console.error(err)
      }
    }),
  )
}
