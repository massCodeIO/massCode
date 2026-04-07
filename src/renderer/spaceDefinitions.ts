import type { Component } from 'vue'
import type { RouteLocationRaw, RouteRecordName } from 'vue-router'
import { i18n, store } from '@/electron'
import { router, RouterName } from '@/router'
import { Blocks, Calculator, Code2, Notebook } from 'lucide-vue-next'

export type SpaceId = 'code' | 'tools' | 'math' | 'notes'

export interface SpaceDefinition {
  id: SpaceId
  label: string
  tooltip: string
  icon: Component
  to: RouteLocationRaw
  isActive: (routeName: RouteRecordName | null | undefined) => boolean
}

function isRouteNameInSpace(
  routeName: RouteRecordName | null | undefined,
  prefix: string,
) {
  return (
    typeof routeName === 'string'
    && (routeName === prefix || routeName.startsWith(`${prefix}/`))
  )
}

function getSavedNotesRouteName() {
  const savedRoute = store.app.get<string>('notes.route')

  if (
    savedRoute === RouterName.notesSpace
    || savedRoute === RouterName.notesDashboard
    || savedRoute === RouterName.notesGraph
  ) {
    return savedRoute
  }

  return RouterName.notesSpace
}

export function getSpaceDefinitions(): SpaceDefinition[] {
  return [
    {
      id: 'code',
      label: i18n.t('spaces.code.label'),
      tooltip: i18n.t('spaces.code.tooltip'),
      icon: Code2,
      to: { name: RouterName.main },
      isActive: routeName => routeName === RouterName.main,
    },
    {
      id: 'notes',
      label: i18n.t('spaces.notes.label'),
      tooltip: i18n.t('spaces.notes.tooltip'),
      icon: Notebook,
      to: { name: getSavedNotesRouteName() },
      isActive: routeName =>
        isRouteNameInSpace(routeName, RouterName.notesSpace),
    },
    {
      id: 'math',
      label: i18n.t('spaces.math.label'),
      tooltip: i18n.t('spaces.math.tooltip'),
      icon: Calculator,
      to: { name: RouterName.mathNotebook },
      isActive: routeName => routeName === RouterName.mathNotebook,
    },
    {
      id: 'tools',
      label: i18n.t('spaces.tools.label'),
      tooltip: i18n.t('spaces.tools.tooltip'),
      icon: Blocks,
      to: { name: RouterName.devtools },
      isActive: routeName =>
        isRouteNameInSpace(routeName, RouterName.devtools),
    },
  ]
}

export function isSpaceRouteName(
  routeName: RouteRecordName | null | undefined,
) {
  return getSpaceDefinitions().some(space => space.isActive(routeName))
}

export function getActiveSpaceId(): SpaceId | null {
  const routeName = router.currentRoute.value.name
  const space = getSpaceDefinitions().find(s => s.isActive(routeName))
  return space?.id ?? null
}
