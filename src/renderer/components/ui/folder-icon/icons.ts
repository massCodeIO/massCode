import type { Component } from 'vue'
import { icons as lucideIcons } from 'lucide-vue-next'

const files = import.meta.glob('@/assets/svg/icons/**.svg', {
  eager: true,
  import: 'default',
  query: '?raw',
})
const re = /\/([^/]+)\.svg$/
const materialIconInnerSvgClass
  = '[&_svg]:block [&_svg]:size-full overflow-hidden'

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

const materialIconsSet: Record<string, string> = {}

const materialIcons: FolderIconOption[] = Object.entries(files)
  .flatMap(([path, raw]) => {
    const name = path.match(re)?.[1]

    if (!name)
      return []

    const svg = raw as string

    materialIconsSet[name] = svg

    return [
      {
        name,
        searchValue: name.toLowerCase(),
        source: 'material' as const,
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

    if (!svg)
      return null

    return {
      name: parsedValue.name,
      searchValue: parsedValue.name.toLowerCase(),
      source: parsedValue.source,
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
  materialIconInnerSvgClass,
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
