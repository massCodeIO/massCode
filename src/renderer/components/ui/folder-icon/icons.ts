import type { Component } from 'vue'
import { icons as lucideIcons } from 'lucide-vue-next'

const files = import.meta.glob('@/assets/svg/icons/**.svg', {
  eager: true,
  import: 'default',
  query: '?raw',
})
const re = /\/([^/]+)\.svg$/
type FolderIconSource = 'material' | 'lucide'
type FolderIconFilter = 'all' | FolderIconSource

interface ParsedFolderIconValue {
  name: string
  source: FolderIconSource
}

interface FolderIconOption {
  component?: Component
  name: string
  searchValue: string
  source: FolderIconSource
  src?: string
  svg?: string
  value: string
}

interface FolderIconGroup {
  items: FolderIconOption[]
  source: FolderIconSource
}

const iconSources: FolderIconSource[] = ['material', 'lucide']

function toKebabCase(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()
}

function createFolderIconValue(source: FolderIconSource, name: string) {
  return `${source}:${name}`
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function sanitizeMaterialIconSvg(name: string, svg: string) {
  const prefix = `folder-icon-${name.replace(/[^\w-]/g, '-')}-`
  const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => id)

  if (ids.length === 0)
    return svg

  return ids.reduce((result, id) => {
    const uniqueId = `${prefix}${id}`
    const escapedId = escapeRegExp(id)

    return result
      .replace(new RegExp(`\\bid="${escapedId}"`, 'g'), `id="${uniqueId}"`)
      .replace(new RegExp(`url\\(#${escapedId}\\)`, 'g'), `url(#${uniqueId})`)
      .replace(
        new RegExp(`\\b(xlink:href|href)="#${escapedId}"`, 'g'),
        `$1="#${uniqueId}"`,
      )
  }, svg)
}

function createMaterialIconSrc(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

const materialIconsSet: Record<string, string> = {}
const materialIconSrcSet: Record<string, string> = {}

const materialIcons: FolderIconOption[] = Object.entries(files)
  .flatMap(([path, raw]) => {
    const name = path.match(re)?.[1]

    if (!name)
      return []

    const svg = sanitizeMaterialIconSvg(name, raw as string)

    materialIconsSet[name] = svg
    materialIconSrcSet[name] = createMaterialIconSrc(svg)

    return [
      {
        name,
        searchValue: name.toLowerCase(),
        source: 'material' as const,
        src: materialIconSrcSet[name],
        svg,
        value: createFolderIconValue('material', name),
      },
    ]
  })
  .sort((left, right) => left.name.localeCompare(right.name))

const lucideIconsSet: Record<string, Component> = {}

const allLucideIcons: FolderIconOption[] = Object.entries(lucideIcons)
  .flatMap(([componentName, component]) => {
    const name = toKebabCase(componentName)

    if (lucideIconsSet[name])
      return []

    lucideIconsSet[name] = component as Component

    return [
      {
        component: component as Component,
        name,
        searchValue: `${name} ${componentName.toLowerCase()}`,
        source: 'lucide' as const,
        value: createFolderIconValue('lucide', name),
      },
    ]
  })
  .sort((left, right) => left.name.localeCompare(right.name))

const allFolderIcons: FolderIconOption[] = [
  ...materialIcons,
  ...allLucideIcons,
]

function parseFolderIconValue(
  value?: string | null,
): ParsedFolderIconValue | null {
  if (!value)
    return null

  const [rawSource, ...rest] = value.split(':')

  if (rest.length === 0) {
    return {
      name: value,
      source: 'material',
    }
  }

  const name = rest.join(':').trim()

  if (!name)
    return null

  if (rawSource !== 'material' && rawSource !== 'lucide')
    return null

  return {
    name,
    source: rawSource,
  }
}

function resolveFolderIcon(value?: string | null): FolderIconOption | null {
  const parsedValue = parseFolderIconValue(value)

  if (!parsedValue)
    return null

  if (parsedValue.source === 'material') {
    const svg = materialIconsSet[parsedValue.name]
    const src = materialIconSrcSet[parsedValue.name]

    if (!svg || !src)
      return null

    return {
      name: parsedValue.name,
      searchValue: parsedValue.name.toLowerCase(),
      source: parsedValue.source,
      src,
      svg,
      value: createFolderIconValue(parsedValue.source, parsedValue.name),
    }
  }

  const component = lucideIconsSet[parsedValue.name]

  if (!component)
    return null

  return {
    component,
    name: parsedValue.name,
    searchValue: parsedValue.name,
    source: parsedValue.source,
    value: createFolderIconValue(parsedValue.source, parsedValue.name),
  }
}

function getFilteredFolderIcons(search = '', filter: FolderIconFilter = 'all') {
  const normalizedSearch = search.trim().toLowerCase()

  return allFolderIcons.filter((icon) => {
    if (filter !== 'all' && icon.source !== filter)
      return false

    if (!normalizedSearch)
      return true

    return icon.searchValue.includes(normalizedSearch)
  })
}

function groupFolderIcons(icons: FolderIconOption[]): FolderIconGroup[] {
  return iconSources.flatMap((source) => {
    const items = icons.filter(icon => icon.source === source)

    if (items.length === 0)
      return []

    return [{ items, source }]
  })
}

export {
  allFolderIcons,
  allLucideIcons,
  createFolderIconValue,
  getFilteredFolderIcons,
  groupFolderIcons,
  materialIcons as icons,
  materialIconsSet as iconsSet,
  materialIcons,
  materialIconsSet,
  parseFolderIconValue,
  resolveFolderIcon,
}

export type {
  FolderIconFilter,
  FolderIconGroup,
  FolderIconOption,
  FolderIconSource,
}
