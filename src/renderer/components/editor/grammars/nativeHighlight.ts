import type { StreamParser } from '@codemirror/language'
import type { Tag } from '@lezer/highlight'
import {
  LanguageSupport,
  LRLanguage,
  StreamLanguage,
} from '@codemirror/language'
import { styleTags, tags } from '@lezer/highlight'

// Correct token categories without replacing the parser's string/comment state.
function withTypes<State>(parser: StreamParser<State>, names: RegExp) {
  return new LanguageSupport(
    StreamLanguage.define({
      ...parser,
      token(stream, state) {
        const token = parser.token(stream, state)
        return (token === 'variable' || token === 'variableName')
          && names.test(stream.current())
          ? 'typeName'
          : token
      },
    }),
  )
}

export async function loadCorrectedStreamLanguage(id: string) {
  if (id === 'fsharp') {
    const { fSharp } = await import('@codemirror/legacy-modes/mode/mllike')
    return withTypes(
      fSharp,
      /^(?:bool|byte|sbyte|int16|uint16|int|uint|int64|uint64|nativeint|unativeint|decimal|float|double|float32|single|char|string|unit|obj)$/,
    )
  }
  if (id === 'd') {
    const { d } = await import('@codemirror/legacy-modes/mode/d')
    return withTypes(d, /^(?:string|dstring)$/)
  }
  if (id === 'powershell') {
    const { powerShell } = await import(
      '@codemirror/legacy-modes/mode/powershell'
    )
    return withTypes(
      powerShell,
      /^(?:string|double|float|int|long|bool|decimal|object|char|byte|datetime)$/i,
    )
  }
  if (id === 'groovy') {
    const { groovy } = await import('@codemirror/legacy-modes/mode/groovy')
    return withTypes(
      groovy,
      /^(?:String|List|Map|Set|Collection|Object|Integer|Double|Boolean|BigDecimal)$/,
    )
  }
  if (id === 'kotlin') {
    const { kotlin } = await import('@codemirror/legacy-modes/mode/clike')
    return withTypes(
      kotlin,
      /^(?:List|MutableList|Map|MutableMap|Set|MutableSet|Collection|Sequence|Array)$/,
    )
  }
  if (id === 'objectivec') {
    const { objectiveC } = await import('@codemirror/legacy-modes/mode/clike')
    return withTypes(
      objectiveC,
      /^(?:NSObject|NSString|NSArray|NSNumber|NSDictionary|NSSet|NSData|NSError|NSDate|NSURL)$/,
    )
  }
  if (id === 'pascal') {
    const { pascal } = await import('@codemirror/legacy-modes/mode/pascal')
    return withTypes(
      pascal,
      /^(?:integer|real|boolean|char|byte|word|longint|shortint|single|double|extended)$/i,
    )
  }
}

export function correctNativeHighlight(id: string, support: LanguageSupport) {
  if (!(support.language instanceof LRLanguage))
    return support
  const rules: Record<string, Tag> | undefined
    = id === 'java'
      ? { 'MarkerAnnotation/Identifier Annotation/Identifier': tags.annotation }
      : id === 'python'
        ? { 'Decorator/VariableName Decorator/At': tags.annotation }
        : undefined
  if (!rules)
    return support
  return new LanguageSupport(
    support.language.configure({ props: [styleTags(rules)] }),
    support.support,
  )
}
