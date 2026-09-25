import { expect, it, vi } from 'vitest'

vi.mock('@/services/api', () => ({ api: {} }))
const { resolveNativeNoteTarget } = await import('../nativeTarget')
const target = { space: 'notes' as const, id: 1 }
it('resolves repeated headings and annotations by current typed occurrence', () => {
  const content
    = '# Repeated\n\n> [!NOTE]\n> Same text\n\n# Repeated\n\n> [!NOTE]\n> Same text'
  const heading = resolveNativeNoteTarget(content, {
    action: 'notesReveal',
    target,
    kind: 'heading',
    value: 'Repeated',
    occurrence: 2,
  })
  expect(heading?.match.from).toBe(content.lastIndexOf('# Repeated'))
  const annotation = resolveNativeNoteTarget(content, {
    action: 'notesReveal',
    target,
    kind: 'annotation',
    value: 'Same text',
    occurrence: 2,
  })
  expect(annotation?.match.from).toBe(content.lastIndexOf('> [!NOTE]'))
  expect(
    resolveNativeNoteTarget(content, {
      action: 'notesReveal',
      target,
      kind: 'heading',
      value: 'Repeated',
      occurrence: 3,
    }),
  ).toBeUndefined()
})
it('resolves repeated internal and external links without accepting model offsets', () => {
  const content
    = '[[Target]] then [[Target|Alias]]\n\n[First](https://example.test) and [Second](https://example.test)'
  const internal = resolveNativeNoteTarget(content, {
    action: 'notesReveal',
    target,
    kind: 'internalLink',
    value: 'Target',
    occurrence: 2,
  })
  expect(internal?.match.from).toBe(content.indexOf('[[Target|Alias]]'))
  const external = resolveNativeNoteTarget(content, {
    action: 'notesReveal',
    target,
    kind: 'externalLink',
    value: 'https://example.test',
    occurrence: 2,
  })
  expect(external?.kind === 'link' ? external.match.raw : undefined).toBe(
    '[Second](https://example.test)',
  )
})
