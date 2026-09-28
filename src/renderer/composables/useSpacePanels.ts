import { useApp, useHttpApp, useNotesApp } from '@/composables'
import { useAi } from '@/composables/ai/useAi'
import { useHttpPanels } from '@/composables/spaces/http/useHttpPanels'
import { store } from '@/electron'
import { router, RouterName } from '@/router'
import { getActiveSpaceId } from '@/spaceDefinitions'

const hiddenSidebars = ref<string[]>(
  store.app.get<string[]>('ui.hiddenSidebars') ?? [],
)
watch(hiddenSidebars, value => store.app.set('ui.hiddenSidebars', value))

let previousAiFocus: HTMLElement | null = null

export function useSpacePanels() {
  const code = useApp()
  const notes = useNotesApp()
  const http = useHttpApp()
  const panels = useHttpPanels()
  const ai = useAi()
  const primaryAvailable = computed(
    () =>
      !!getActiveSpaceId()
      && router.currentRoute.value.name !== RouterName.notesPresentation,
  )
  const notesInspectorAvailable = computed(
    () =>
      router.currentRoute.value.name === RouterName.notesSpace
      && !notes.isNotesMindmapShown.value
      && !notes.isNotesPresentationShown.value,
  )
  const primaryOpen = computed(() => {
    if (!primaryAvailable.value)
      return false
    const space = getActiveSpaceId()
    if (space === 'code')
      return !code.isSidebarHidden.value
    if (space === 'notes')
      return !notes.isNotesSidebarHidden.value
    if (space === 'http')
      return !http.isHttpSidebarHidden.value
    return !!space && !hiddenSidebars.value.includes(space)
  })
  const secondaryAvailable = computed(() => {
    const space = getActiveSpaceId()
    return space === 'code' || space === 'notes' || space === 'http'
  })
  const secondaryOpen = computed(() => {
    const space = getActiveSpaceId()
    if (!secondaryAvailable.value)
      return false
    if (ai.open.value)
      return true
    if (space === 'notes')
      return notes.isNotesInspectorOpen.value && notesInspectorAvailable.value
    return space === 'http' && panels.inspectorOpen.value
  })

  function togglePrimary() {
    if (!primaryAvailable.value)
      return
    const space = getActiveSpaceId()
    if (space === 'code') {
      code.toggleCodeSidebar()
    }
    else if (space === 'notes') {
      notes.toggleNotesSidebar()
    }
    else if (space === 'http') {
      http.toggleHttpSidebar()
    }
    else if (space) {
      hiddenSidebars.value = primaryOpen.value
        ? [...hiddenSidebars.value, space]
        : hiddenSidebars.value.filter(id => id !== space)
    }
  }

  function closeSecondary() {
    const space = getActiveSpaceId()
    ai.setOpen(false)
    if (space === 'notes')
      notes.isNotesInspectorOpen.value = false
    if (space === 'http')
      panels.inspectorOpen.value = false
  }

  function toggleSecondary() {
    if (!secondaryAvailable.value)
      return
    if (secondaryOpen.value) {
      closeSecondary()
      return
    }
    const space = getActiveSpaceId()
    if (space === 'notes' && notesInspectorAvailable.value)
      notes.isNotesInspectorOpen.value = true
    else if (space === 'http')
      panels.inspectorOpen.value = true
    else ai.setOpen(true)
  }

  async function toggleAi() {
    if (!secondaryAvailable.value)
      return
    const active = document.activeElement as HTMLElement | null
    if (ai.open.value && active?.closest('[data-ai-panel]')) {
      closeSecondary()
      await nextTick()
      const target = previousAiFocus?.isConnected
        ? previousAiFocus
        : Array.from(
            document.querySelectorAll<HTMLElement>('.cm-content'),
          ).find(
            element =>
              !element.closest('[data-ai-panel]')
              && element.offsetParent !== null,
          )
      target?.focus()
      previousAiFocus = null
      return
    }
    if (
      active
      && active !== document.body
      && !active.closest('[data-ai-panel]')
    ) {
      previousAiFocus = active
    }
    await ai.openAndFocus()
  }

  return {
    primaryAvailable,
    primaryOpen,
    secondaryOpen,
    secondaryAvailable,
    togglePrimary,
    toggleSecondary,
    closeSecondary,
    toggleAi,
  }
}
