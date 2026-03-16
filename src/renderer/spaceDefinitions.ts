import type { Component } from 'vue'
import type { RouteLocationRaw, RouteRecordName } from 'vue-router'
import { i18n } from '@/electron'
import { router, RouterName } from '@/router'
import {
  Blocks,
  Calculator,
  Code2,
  FlaskConical,
  Notebook,
} from 'lucide-vue-next'

export type SpaceId = 'code' | 'tools' | 'math' | 'dev' | 'notes'

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

export function getSpaceDefinitions(): SpaceDefinition[] {
  return [
    {
      id: 'code',
      label: i18n.t('spaces.code'),
      tooltip: i18n.t('spaces.codeTooltip'),
      icon: Code2,
      to: { name: RouterName.main },
      isActive: routeName => routeName === RouterName.main,
    },
    {
      id: 'tools',
      label: i18n.t('spaces.tools'),
      tooltip: i18n.t('spaces.toolsTooltip'),
      icon: Blocks,
      to: { name: RouterName.devtoolsCaseConverter },
      isActive: routeName =>
        isRouteNameInSpace(routeName, RouterName.devtools),
    },
    {
      id: 'math',
      label: i18n.t('spaces.math'),
      tooltip: i18n.t('spaces.mathTooltip'),
      icon: Calculator,
      to: { name: RouterName.mathNotebook },
      isActive: routeName => routeName === RouterName.mathNotebook,
    },
    {
      id: 'notes',
      label: i18n.t('spaces.notes'),
      tooltip: i18n.t('spaces.notesTooltip'),
      icon: Notebook,
      to: { name: RouterName.notesSpace },
      isActive: routeName => routeName === RouterName.notesSpace,
    },
    {
      id: 'dev',
      label: 'Dev',
      tooltip: 'Development playground',
      icon: FlaskConical,
      to: { name: RouterName.dev },
      isActive: routeName => routeName === RouterName.dev,
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
