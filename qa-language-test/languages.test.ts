import { writeFileSync } from 'node:fs'
import { ensureSyntaxTree, StreamLanguage } from '@codemirror/language'
import { languages as nativeLanguages } from '@codemirror/language-data'
import { EditorState } from '@codemirror/state'
import { highlightTree } from '@lezer/highlight'
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { codeHighlighter } from '../src/renderer/components/cm-extensions/codeHighlight'
import { loadLanguageSupport } from '../src/renderer/components/editor/grammars'
import { codeLanguageIds } from '../src/shared/codeLanguages'
import corpusData from './corpus.json'
import { legacySpans } from './legacy'

// Only the browser URL fetch is replaced; grammar loading and Oniguruma are real.
vi.mock('onigasm', async () => {
  const { createRequire } = await import('node:module')
  const { readFileSync } = await import('node:fs')
  const require = createRequire(import.meta.url)
  return {
    loadWASM: () => {
      const bytes = readFileSync(require.resolve('onigasm/lib/onigasm.wasm'))
      return require('onigasm').loadWASM(
        bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ),
      )
    },
  }
})

const diagnosticMessages: string[] = []
beforeEach(() => {
  diagnosticMessages.length = 0
  for (const method of ['warn', 'error', 'log'] as const) {
    // Keep engine diagnostics visible while also failing on tokenizer loops.
    // eslint-disable-next-line no-console
    const original = console[method].bind(console)
    vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
      diagnosticMessages.push(args.map(String).join(' '))
      original(...args)
    })
  }
})
afterEach(() => {
  vi.restoreAllMocks()
  expect(
    diagnosticMessages.filter(message =>
      /endless loop|invalid pattern/i.test(message),
    ),
    'Tokenizer diagnostics',
  ).toEqual([])
})

interface TokenCheck {
  from: number
  to: number
  text: string
  category: string
  construct?: string
  notCategories?: string[]
}
interface KnownGap {
  from: number
  to: number
  text: string
  expectedCategory: string
  reason: string
}
interface Fixture {
  id: string
  source: string
  checks: TokenCheck[]
  requiredCategories?: string[]
  knownGaps?: KnownGap[]
  legacyChanges?: { from: number, to: number, text: string, reason: string }[]
}
const corpus: Fixture[] = corpusData

interface Span {
  from: number
  to: number
  classes: string
  text: string
}
function collectSpans(
  tree: Parameters<typeof highlightTree>[0],
  source: string,
): Span[] {
  const spans: Span[] = []
  highlightTree(tree, codeHighlighter, (from, to, classes) => {
    spans.push({ from, to, classes, text: source.slice(from, to) })
  })
  return spans
}
const requiredCategories = [
  'positive',
  'negative',
  'keyword',
  'string',
  'string-2',
  'number',
  'atom',
  'comment',
  'def',
  'type',
  'variable',
  'variable-2',
  'variable-3',
  'bracket',
  'property',
  'operator',
  'punctuation',
  'meta',
  'tag',
  'attribute',
  'header',
  'strong',
  'em',
  'link',
]

const results: {
  id: string
  backend: string
  knownGaps: KnownGap[]
  spans: Span[]
  legacy: Span[]
  failures: string[]
  checkedCategories: string[]
  renderedCategories: string[]
  missingChecks: string[]
  requiredCategories: string[]
  constructs: string[]
  lines: number
  changes: { text: string, from: number, old: string, current: string }[]
}[] = []

afterAll(() => {
  if (process.env.QA_LANGUAGE_REPORT) {
    writeFileSync(
      process.env.QA_LANGUAGE_REPORT,
      `${JSON.stringify(results, null, 2)}\n`,
    )
  }
})

it('covers every unique picker ID exactly once', () => {
  expect(corpus.map(item => item.id).sort()).toEqual(
    [...codeLanguageIds].sort(),
  )
})

it('exercises every public token category with an explicit assertion', () => {
  const categories = [
    ...new Set(
      corpus.flatMap(item => item.checks.map(check => check.category)),
    ),
  ]
  expect(categories.sort()).toEqual([...requiredCategories].sort())
})

describe('representative syntax in every supported language', () => {
  for (const fixture of corpus) {
    it(fixture.id, async () => {
      const support = await loadLanguageSupport(fixture.id)
      let spans: Span[] = []
      if (support) {
        const tree = support.language.parser.parse(fixture.source)
        spans = collectSpans(tree, fixture.source)
      }
      const failures: string[] = []
      const plannedCategories = fixture.requiredCategories ?? []
      const constructs = [
        ...new Set(
          fixture.checks
            .map(check => check.construct)
            .filter((name): name is string => Boolean(name)),
        ),
      ].sort()
      const checkedCategories = [
        ...new Set(fixture.checks.map(check => check.category)),
      ].sort()
      const renderedCategories = [
        ...new Set(
          spans
            .filter(span => /\S/.test(span.text))
            .flatMap(span =>
              span.classes.split(' ').map(name => name.replace(/^cm-/, '')),
            ),
        ),
      ].sort()
      const missingChecks = renderedCategories.filter(
        category => !checkedCategories.includes(category),
      )
      if (missingChecks.length) {
        failures.push(
          `Rendered categories without explicit checks: ${missingChecks.join(', ')}`,
        )
      }
      if (fixture.id === 'plain_text') {
        expect(support).toBeUndefined()
        expect(spans).toEqual([])
      }
      else {
        expect(support, fixture.id).toBeDefined()
        if (!plannedCategories.length)
          failures.push('Missing independent category plan')
        for (const category of plannedCategories) {
          if (!checkedCategories.includes(category))
            failures.push(`Planned category has no assertion: ${category}`)
          if (!renderedCategories.includes(category))
            failures.push(`Planned category is not rendered: ${category}`)
        }
        if (fixture.checks.length < 2)
          failures.push('At least two semantic assertions are required')
        for (const check of fixture.checks) {
          if (!check.construct?.trim()) {
            failures.push(
              `Missing construct label for ${JSON.stringify(check.text)}`,
            )
          }
          expect(
            check.to,
            'Token assertions must cover a non-empty range',
          ).toBeGreaterThan(check.from)
          expect(fixture.source.slice(check.from, check.to)).toBe(check.text)
          for (const category of check.notCategories ?? []) {
            if (
              spans.some(
                span =>
                  span.from < check.to
                  && span.to > check.from
                  && span.classes.split(' ').includes(`cm-${category}`),
              )
            ) {
              failures.push(
                `${check.construct}: forbidden cm-${category} on ${JSON.stringify(check.text)}`,
              )
            }
          }
          for (let pos = check.from; pos < check.to; pos++) {
            if (
              !spans.some(
                span =>
                  span.from <= pos
                  && span.to > pos
                  && span.classes.split(' ').includes(`cm-${check.category}`),
              )
            ) {
              failures.push(
                `${JSON.stringify(check.text)} expected cm-${check.category} at ${pos}, got ${
                  spans
                    .filter(
                      span => span.to > check.from && span.from < check.to,
                    )
                    .map(
                      span => `${JSON.stringify(span.text)}:${span.classes}`,
                    )
                    .join(', ') || 'plain'
                }`,
              )
              break
            }
          }
        }
      }
      for (const gap of fixture.knownGaps ?? []) {
        expect(fixture.source.slice(gap.from, gap.to)).toBe(gap.text)
        expect(gap.reason.trim()).not.toBe('')
        expect(requiredCategories).toContain(gap.expectedCategory)
        expect(gap.to).toBeGreaterThan(gap.from)
        const resolved = Array.from(
          { length: gap.to - gap.from },
          (_, offset) => gap.from + offset,
        ).every(pos =>
          spans.some(
            span =>
              span.from <= pos
              && span.to > pos
              && span.classes.split(' ').includes(`cm-${gap.expectedCategory}`),
          ),
        )
        if (resolved) {
          failures.push(
            `Known gap is now resolved; promote to an assertion: ${JSON.stringify(gap.text)}`,
          )
        }
      }
      if (support) {
        // Exercise invalidation through CM6 state updates, independently of full parsing.
        let state = EditorState.create({
          doc: fixture.source,
          extensions: [support],
        })
        expect(
          ensureSyntaxTree(state, state.doc.length, 1000),
          'Initial editor parse',
        ).not.toBeNull()
        const lexicalToken = fixture.checks.find(check =>
          ['string', 'comment'].includes(check.category),
        )
        const position = lexicalToken
          ? lexicalToken.from + Math.floor(lexicalToken.text.length / 2)
          : Math.floor(fixture.source.length / 2)
        for (const change of [
          { from: position, insert: '\n' },
          { from: position, to: position + 1 },
        ]) {
          state = state.update({ changes: change }).state
          const source = state.doc.toString()
          const incrementalTree = ensureSyntaxTree(
            state,
            state.doc.length,
            1000,
          )
          if (!incrementalTree) {
            failures.push('Incremental editor parse did not complete')
            break
          }
          const incremental = collectSpans(incrementalTree, source)
          const fresh = collectSpans(
            support.language.parser.parse(source),
            source,
          )
          if (JSON.stringify(incremental) !== JSON.stringify(fresh)) {
            failures.push(
              'Highlighting after editing differs from a fresh parse',
            )
          }
        }
      }
      const legacy = await legacySpans(fixture.id, fixture.source)
      const native = nativeLanguages.some(
        item => item.support?.language === support?.language,
      )
      const backend = !support
        ? 'plain'
        : native
          ? support.language instanceof StreamLanguage
            ? 'native-stream'
            : 'native-lezer'
          : 'textmate'
      const changes = []
      for (const span of legacy) {
        const current = [
          ...new Set(
            spans
              .filter(item => item.from < span.to && item.to > span.from)
              .map(item => item.classes),
          ),
        ].join(' ')
        if (current !== span.classes) {
          changes.push({
            text: span.text,
            from: span.from,
            old: span.classes,
            current: current || 'plain',
          })
        }
      }
      for (const change of fixture.legacyChanges ?? []) {
        expect(fixture.source.slice(change.from, change.to)).toBe(change.text)
        expect(change.reason.trim()).not.toBe('')
        expect(change.to).toBeGreaterThan(change.from)
      }
      if (backend === 'textmate') {
        for (const span of legacy) {
          for (let pos = span.from; pos < span.to; pos++) {
            if (/\s/.test(fixture.source[pos]!))
              continue
            const actual = spans.find(
              item => item.from <= pos && item.to > pos,
            )?.classes
            const acceptedChange = fixture.legacyChanges?.some(
              change => pos >= change.from && pos < change.to,
            )
            if (
              actual !== span.classes
              && acceptedChange
              && !fixture.checks.some(
                check =>
                  check.from <= pos
                  && pos < check.to
                  && actual?.split(' ').includes(`cm-${check.category}`),
              )
            ) {
              failures.push(
                `Accepted mapping change needs a positive assertion at ${pos}`,
              )
              break
            }
            if (actual !== span.classes && !acceptedChange) {
              failures.push(
                `Scope mapping regression ${JSON.stringify(span.text)} at ${pos}: ${span.classes} → ${actual || 'plain'}`,
              )
              break
            }
          }
        }
      }
      results.push({
        id: fixture.id,
        backend,
        knownGaps: fixture.knownGaps ?? [],
        spans,
        legacy,
        failures,
        checkedCategories,
        renderedCategories,
        missingChecks,
        requiredCategories: plannedCategories,
        constructs,
        lines: fixture.source.split('\n').length,
        changes,
      })
      expect(failures, fixture.id).toEqual([])
    })
  }
})
