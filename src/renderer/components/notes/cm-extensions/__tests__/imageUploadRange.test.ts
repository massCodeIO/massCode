import { EditorState } from '@codemirror/state'
import { expect, it } from 'vitest'
import { imageUploadRanges, trackImageUpload } from '../imageUploadRange'

const marker = '![Uploading]()'
function state() {
  return EditorState.create({
    doc: `before ${marker} after`,
    extensions: [imageUploadRanges],
  }).update({
    effects: trackImageUpload.of({ id: 'one', from: 7, text: marker }),
  }).state
}
it('tracks the upload placeholder when independent text is inserted before or after it', () => {
  const next = state().update({
    changes: [
      { from: 0, insert: 'new ' },
      { from: 7 + marker.length, insert: 'manual' },
    ],
  }).state
  const range = next.field(imageUploadRanges).get('one')!
  expect(next.doc.sliceString(range.from, range.to)).toBe(marker)
  expect(range.from).toBe(11)
})
it('drops the upload range if the user edits it or a different note replaces the document', () => {
  const original = state()
  expect(
    original
      .update({ changes: { from: 8, to: 9, insert: 'x' } })
      .state.field(imageUploadRanges).size,
  ).toBe(0)
  expect(
    original
      .update({
        changes: { from: 0, to: original.doc.length, insert: 'another note' },
      })
      .state.field(imageUploadRanges).size,
  ).toBe(0)
})

it('tracks an upload insertion point without persisting a placeholder in the note', () => {
  const original = EditorState.create({
    doc: 'abc',
    extensions: [imageUploadRanges],
  }).update({
    effects: trackImageUpload.of({ id: 'one', from: 1, text: '' }),
  }).state
  expect(original.doc.toString()).toBe('abc')
  const next = original.update({
    changes: { from: 1, insert: 'manual' },
  }).state
  expect(next.field(imageUploadRanges).get('one')).toMatchObject({
    from: 7,
    to: 7,
  })
  expect(
    next
      .update({
        changes: { from: 0, to: next.doc.length, insert: 'different' },
      })
      .state.field(imageUploadRanges).size,
  ).toBe(0)
})
