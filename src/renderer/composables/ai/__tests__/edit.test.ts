import type { AiToolCall } from '~/shared/ai'
import { describe, expect, it } from 'vitest'
import { buildReplacement, editLines, matchesSnapshot } from '../edit'

const contextId = '11111111-1111-4111-8111-111111111111'
const snapshot = {
  contextId,
  snippetId: 1,
  contentId: 2,
  text: 'alpha beta gamma\n',
  from: 0,
  to: 17,
  vault: 'a',
}
function call(
  edits: { old_text: string, new_text: string }[],
  target = contextId,
): AiToolCall {
  return {
    id: 'call_1',
    type: 'function',
    function: {
      name: 'propose_edit',
      arguments: JSON.stringify({
        context_id: target,
        summary: 'Update',
        edits,
      }),
    },
  }
}

describe('structured edit validation', () => {
  it('applies multiple exact replacements atomically and preserves all other text', () => {
    expect(
      buildReplacement(snapshot, [
        call([
          { old_text: 'alpha', new_text: 'A' },
          { old_text: 'gamma', new_text: 'C' },
        ]),
      ]),
    ).toBe('A beta C\n')
    expect(
      buildReplacement(snapshot, [call([{ old_text: 'beta', new_text: '' }])]),
    ).toBe('alpha  gamma\n')
  })
  it('rejects missing, ambiguous, overlapping and wrong-target edits', () => {
    for (const edits of [
      [{ old_text: 'missing', new_text: 'x' }],
      [{ old_text: 'a', new_text: 'x' }],
      [
        { old_text: 'alpha beta', new_text: 'x' },
        { old_text: 'beta', new_text: 'y' },
      ],
    ])
      expect(buildReplacement(snapshot, [call(edits)])).toBeUndefined()
    expect(
      buildReplacement(snapshot, [
        call(
          [{ old_text: 'alpha', new_text: 'x' }],
          '22222222-2222-4222-8222-222222222222',
        ),
      ]),
    ).toBeUndefined()
  })
  it('checks the whole fragment, identity and vault', () => {
    expect(matchesSnapshot(snapshot, snapshot, 'a')).toBe(true)
    expect(matchesSnapshot(snapshot, { ...snapshot, contentId: 3 }, 'a')).toBe(
      false,
    )
    expect(
      matchesSnapshot(snapshot, { ...snapshot, text: 'modified' }, 'a'),
    ).toBe(false)
    expect(matchesSnapshot(snapshot, snapshot, 'b')).toBe(false)
  })
  it('preserves unchanged boundaries in the diff', () => {
    expect(editLines('a\nb\nc', 'a\nx\nc')).toEqual([
      { type: 'same', text: 'a' },
      { type: 'removed', text: 'b' },
      { type: 'added', text: 'x' },
      { type: 'same', text: 'c' },
    ])
  })
})
