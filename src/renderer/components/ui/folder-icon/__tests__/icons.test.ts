import { describe, expect, it } from 'vitest'
import {
  createFolderIconValue,
  getFilteredFolderIcons,
  groupFolderIcons,
  parseFolderIconValue,
  resolveFolderIcon,
} from '../icons'

describe('parseFolderIconValue', () => {
  it('treats legacy values without a prefix as material icons', () => {
    expect(parseFolderIconValue('typescript')).toEqual({
      name: 'typescript',
      source: 'material',
    })
  })

  it('parses prefixed material icons', () => {
    expect(parseFolderIconValue('material:typescript')).toEqual({
      name: 'typescript',
      source: 'material',
    })
  })

  it('parses prefixed lucide icons', () => {
    expect(parseFolderIconValue('lucide:folder-open')).toEqual({
      name: 'folder-open',
      source: 'lucide',
    })
  })

  it('returns null for unsupported values', () => {
    expect(parseFolderIconValue('unknown:folder')).toBeNull()
    expect(parseFolderIconValue('lucide:')).toBeNull()
    expect(parseFolderIconValue(null)).toBeNull()
  })
})

describe('createFolderIconValue', () => {
  it('serializes material icons with a source prefix', () => {
    expect(createFolderIconValue('material', 'typescript')).toBe(
      'material:typescript',
    )
  })

  it('serializes lucide icons with a source prefix', () => {
    expect(createFolderIconValue('lucide', 'folder-open')).toBe(
      'lucide:folder-open',
    )
  })
})

describe('resolveFolderIcon', () => {
  it('resolves legacy material values', () => {
    expect(resolveFolderIcon('typescript')).toMatchObject({
      name: 'typescript',
      source: 'material',
      value: 'material:typescript',
    })
  })

  it('resolves lucide icons', () => {
    const icon = resolveFolderIcon('lucide:folder-open')

    expect(icon).toMatchObject({
      name: 'folder-open',
      source: 'lucide',
      value: 'lucide:folder-open',
    })
    expect(icon?.component).toBeTypeOf('function')
  })

  it('returns null when an icon cannot be found', () => {
    expect(resolveFolderIcon('lucide:not-a-real-icon')).toBeNull()
  })
})

describe('folder icon filtering', () => {
  it('returns icons from both sources for the all filter', () => {
    const groupedIcons = groupFolderIcons(getFilteredFolderIcons('', 'all'))

    expect(groupedIcons.map(group => group.source)).toEqual([
      'material',
      'lucide',
    ])
    expect(groupedIcons[0]?.items.length).toBeGreaterThan(0)
    expect(groupedIcons[1]?.items.length).toBeGreaterThan(0)
  })

  it('returns only material icons for the material filter', () => {
    const groupedIcons = groupFolderIcons(
      getFilteredFolderIcons('', 'material'),
    )

    expect(groupedIcons).toHaveLength(1)
    expect(groupedIcons[0]?.source).toBe('material')
  })

  it('returns only lucide icons for the lucide filter', () => {
    const groupedIcons = groupFolderIcons(getFilteredFolderIcons('', 'lucide'))

    expect(groupedIcons).toHaveLength(1)
    expect(groupedIcons[0]?.source).toBe('lucide')
  })

  it('searches inside the active icon source', () => {
    const lucideIcons = getFilteredFolderIcons('folder-open', 'lucide')
    const materialIcons = getFilteredFolderIcons('folder-open', 'material')

    expect(lucideIcons.some(icon => icon.name === 'folder-open')).toBe(true)
    expect(materialIcons).toEqual([])
  })
})

describe('material icon rendering', () => {
  it('resolves material icons to isolated data urls', () => {
    const icon = resolveFolderIcon('typescript')

    expect(icon?.src).toMatch(/^data:image\/svg\+xml;charset=utf-8,/)
    expect(icon?.svg).toContain('<svg')
  })

  it('prefixes inline svg ids to avoid collisions between icons', () => {
    const gitpod = resolveFolderIcon('gitpod')
    const vuexStore = resolveFolderIcon('vuex-store')

    expect(gitpod?.svg).toContain('id="folder-icon-gitpod-a"')
    expect(gitpod?.svg).toContain('clip-path="url(#folder-icon-gitpod-a)"')
    expect(gitpod?.svg).not.toContain('clip-path="url(#a)"')

    expect(vuexStore?.svg).toContain('id="folder-icon-vuex-store-a"')
    expect(vuexStore?.svg).toContain(
      'clip-path="url(#folder-icon-vuex-store-a)"',
    )
    expect(vuexStore?.svg).not.toContain('clip-path="url(#a)"')
  })

  it('updates href references inside defs when ids are prefixed', () => {
    const docker = resolveFolderIcon('folder-docker')

    expect(docker?.svg).toContain('id="folder-icon-folder-docker-a"')
    expect(docker?.svg).toContain('id="folder-icon-folder-docker-b"')
    expect(docker?.svg).toContain('xlink:href="#folder-icon-folder-docker-a"')
    expect(docker?.svg).toContain(
      'clip-path="url(#folder-icon-folder-docker-b)"',
    )
  })
})
