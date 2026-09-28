import { describe, expect, it } from 'vitest'
import {
  getActiveCommandPaletteFilterToken,
  parseCommandPaletteQuery,
} from '../queryParser'

const scopeOptions = [
  { spaceId: 'code', title: 'Code' },
  { spaceId: 'notes', title: 'Notes' },
  { spaceId: 'http', title: 'HTTP' },
] as const

const tagOptions = [
  { id: 1, name: 'react', spaceId: 'code' },
  { id: 2, name: 'release', spaceId: 'notes' },
] as const

const folderOptions = [
  { id: 10, name: 'work', path: 'work', spaceId: 'code' },
  { id: 11, name: 'api', path: 'work/api', spaceId: 'code' },
  { id: 12, name: 'meetings', path: 'meetings', spaceId: 'notes' },
  { id: 13, name: 'webhooks', path: 'webhooks', spaceId: 'http' },
] as const

describe('parseCommandPaletteQuery', () => {
  it('extracts a leading space scope token', () => {
    expect(parseCommandPaletteQuery('@notes migration', scopeOptions)).toEqual({
      query: 'migration',
      scopeSpaceId: 'notes',
    })
  })

  it('keeps trailing scope-looking tokens in the text query', () => {
    expect(parseCommandPaletteQuery('migration @code', scopeOptions)).toEqual({
      query: 'migration @code',
      scopeSpaceId: undefined,
    })
  })

  it('sets scope without requiring a text query', () => {
    expect(parseCommandPaletteQuery('@http', scopeOptions)).toEqual({
      query: '',
      scopeSpaceId: 'http',
    })
  })

  it('keeps partial or unknown scope tokens in the text query', () => {
    expect(parseCommandPaletteQuery('@no migration', scopeOptions)).toEqual({
      query: '@no migration',
      scopeSpaceId: undefined,
    })
  })

  it('only extracts the leading scope token when several are present', () => {
    expect(
      parseCommandPaletteQuery('@code migration @notes', scopeOptions),
    ).toEqual({
      query: 'migration @notes',
      scopeSpaceId: 'code',
    })
  })

  it('extracts a tag token for the leading scope', () => {
    expect(
      parseCommandPaletteQuery('@code #react hooks', scopeOptions, {
        tagOptions,
      }),
    ).toEqual({
      query: 'hooks',
      scopeSpaceId: 'code',
      tagFilter: { id: 1, name: 'react', spaceId: 'code' },
    })
  })

  it('keeps unknown tag tokens in the text query', () => {
    expect(
      parseCommandPaletteQuery('@code #unknown hooks', scopeOptions, {
        tagOptions,
      }),
    ).toEqual({
      query: '#unknown hooks',
      scopeSpaceId: 'code',
      tagFilter: undefined,
    })
  })

  it('extracts a tag token from an active scope', () => {
    expect(
      parseCommandPaletteQuery('#release migration', scopeOptions, {
        activeScopeSpaceId: 'notes',
        tagOptions,
      }),
    ).toEqual({
      query: 'migration',
      scopeSpaceId: undefined,
      tagFilter: { id: 2, name: 'release', spaceId: 'notes' },
    })
  })

  it('extracts a folder token for the leading scope', () => {
    expect(
      parseCommandPaletteQuery('@code /work hooks', scopeOptions, {
        folderOptions,
      }),
    ).toEqual({
      folderFilter: { id: 10, name: 'work', path: 'work', spaceId: 'code' },
      query: 'hooks',
      scopeSpaceId: 'code',
      tagFilter: undefined,
    })
  })

  it('matches nested folder path tokens', () => {
    expect(
      parseCommandPaletteQuery('@code /work/api hooks', scopeOptions, {
        folderOptions,
      }),
    ).toEqual({
      folderFilter: { id: 11, name: 'api', path: 'work/api', spaceId: 'code' },
      query: 'hooks',
      scopeSpaceId: 'code',
      tagFilter: undefined,
    })
  })

  it('extracts tag and folder tokens together', () => {
    expect(
      parseCommandPaletteQuery('@code #react /work hooks', scopeOptions, {
        folderOptions,
        tagOptions,
      }),
    ).toEqual({
      folderFilter: { id: 10, name: 'work', path: 'work', spaceId: 'code' },
      query: 'hooks',
      scopeSpaceId: 'code',
      tagFilter: { id: 1, name: 'react', spaceId: 'code' },
    })
  })
})

describe('getActiveCommandPaletteFilterToken', () => {
  it('returns a trailing tag token', () => {
    expect(getActiveCommandPaletteFilterToken('hooks #re')).toEqual({
      kind: 'tag',
      prefix: 're',
      token: '#re',
    })
  })

  it('returns a trailing folder token', () => {
    expect(getActiveCommandPaletteFilterToken('hooks /work/ap')).toEqual({
      kind: 'folder',
      prefix: 'work/ap',
      token: '/work/ap',
    })
  })

  it('ignores tokens outside the active trailing position', () => {
    expect(getActiveCommandPaletteFilterToken('#react hooks')).toBeUndefined()
  })
})
