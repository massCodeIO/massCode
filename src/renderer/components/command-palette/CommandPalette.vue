<script setup lang="ts">
import type { SnippetItemResponse } from '@/services/api/generated'
import type { Component } from 'vue'
import * as Command from '@/components/ui/shadcn/command'
import {
  type CommandPaletteUsageScoreEntry,
  getCommandPaletteResultScore,
} from '@/composables/command-palette/ranking'
import { useHttpEnvironments } from '@/composables/spaces/http'
import {
  type CommandPaletteResult,
  useCommandPalette,
} from '@/composables/useCommandPalette'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { i18n, ipc } from '@/electron'
import { api } from '@/services/api'
import { isMac } from '@/utils'
import { Copy, FolderOpen } from 'lucide-vue-next'
import { buildHttpPreview } from '../http/requestPreview'

interface CommandPaletteAction {
  id: string
  title: string
  subtitle: string
  icon: Component
  run: () => Promise<void> | void
  closeOnRun?: boolean
}

interface CommandPaletteFooterHint {
  label: string
  keys: string[]
}

type SnippetContentSource =
  | Extract<CommandPaletteResult, { type: 'snippet' }>['item']
  | SnippetItemResponse
type RecentTarget = Extract<
  CommandPaletteResult,
  { type: 'recent' }
>['recent']['target']
type ItemResultType = 'snippet' | 'note' | 'http-request'

const {
  clearSearchScope,
  commandResults,
  contentResults,
  createFallbackResults,
  hasQuery,
  isOpen,
  isSearching,
  isSpaceMode,
  openResult,
  query,
  recentResults,
  scopeSpaceResults,
  scopedRecentResults,
  searchScope,
  selectSearchScope,
  setQuery,
  spaceResults,
  usageById,
} = useCommandPalette()

const { activeEnvironment } = useHttpEnvironments()
const isOpeningResult = ref(false)
const isActionPanelOpen = ref(false)
const activeIndex = ref(0)
const activeActionIndex = ref(0)
const activeNavigationDirection = ref<0 | 1 | -1>(0)
let commandModeCaretFrame: number | undefined
const copyToClipboard = useCopyToClipboard()

const normalizedQuery = computed(() => query.value.trim().toLowerCase())
const isScopedSearch = computed(() => Boolean(searchScope.value))
const isCommandMode = computed(
  () => !isScopedSearch.value && query.value.startsWith('>'),
)
const normalizedSearchQuery = computed(() =>
  isCommandMode.value
    ? query.value.slice(1).trim().toLowerCase()
    : isSpaceMode.value
      ? query.value.slice(1).trim().toLowerCase()
      : normalizedQuery.value,
)
const searchScopeLabel = computed(() => searchScope.value?.label)
const inputPlaceholder = computed(() => {
  if (searchScope.value) {
    return i18n.t('commandPalette.scopedPlaceholder', {
      space: searchScope.value.label,
    })
  }

  if (isCommandMode.value) {
    return i18n.t('commandPalette.commandPlaceholder')
  }

  return i18n.t('commandPalette.placeholder')
})

function matchesQuery(result: CommandPaletteResult) {
  if (!normalizedSearchQuery.value) {
    return true
  }

  return getSearchValues(result).some(value =>
    value.toLowerCase().includes(normalizedSearchQuery.value),
  )
}

function isLocalResult(result: CommandPaletteResult | undefined) {
  return result?.type === 'command' || result?.type === 'space'
}

function getSearchValues(result: CommandPaletteResult) {
  return [result.title, ...getSearchKeywords(result)]
}

function getSearchKeywords(result: CommandPaletteResult) {
  const keywords: string[] = []

  if (result.type === 'command') {
    keywords.push(result.command.id)
    keywords.push(...result.command.keywords)
  }

  if (result.type === 'space') {
    keywords.push(result.spaceId)
  }

  return keywords
}

function rankLocalResults(results: CommandPaletteResult[]) {
  if (!normalizedSearchQuery.value) {
    return results
  }

  return results
    .map((result, index) => ({
      index,
      result,
      score: getCommandPaletteResultScore(
        {
          id: result.id,
          title: result.title,
          keywords: getSearchKeywords(result),
        },
        {
          query: normalizedSearchQuery.value,
          usageById: usageById.value as Map<
            string,
            CommandPaletteUsageScoreEntry
          >,
        },
      ),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score
      }

      return a.index - b.index
    })
    .map(item => item.result)
}

function isStrongLocalMatch(result: CommandPaletteResult) {
  if (!normalizedSearchQuery.value) {
    return false
  }

  return getSearchValues(result)
    .flatMap(value => value.toLowerCase().split(/[^a-z0-9]+/))
    .some(token => token.startsWith(normalizedSearchQuery.value))
}

const matchedCommandResults = computed<CommandPaletteResult[]>(() =>
  rankLocalResults(commandResults.value.filter(matchesQuery)),
)

const matchedSpaceResults = computed<CommandPaletteResult[]>(() =>
  rankLocalResults(
    (isSpaceMode.value ? scopeSpaceResults.value : spaceResults.value).filter(
      matchesQuery,
    ),
  ),
)

const primaryCommandResults = computed<CommandPaletteResult[]>(() =>
  matchedCommandResults.value.filter(isStrongLocalMatch),
)

const primarySpaceResults = computed<CommandPaletteResult[]>(() =>
  matchedSpaceResults.value.filter(isStrongLocalMatch),
)

const secondaryCommandResults = computed<CommandPaletteResult[]>(() =>
  matchedCommandResults.value.filter(result => !isStrongLocalMatch(result)),
)

const secondarySpaceResults = computed<CommandPaletteResult[]>(() =>
  matchedSpaceResults.value.filter(result => !isStrongLocalMatch(result)),
)

const hasSearchResults = computed(() => {
  if (isScopedSearch.value) {
    return contentResults.value.length > 0
  }

  if (isSpaceMode.value) {
    return matchedSpaceResults.value.length > 0
  }

  if (isCommandMode.value) {
    return matchedCommandResults.value.length > 0
  }

  return (
    matchedCommandResults.value.length > 0
    || matchedSpaceResults.value.length > 0
    || contentResults.value.length > 0
  )
})

const showCreateFallbacks = computed(
  () =>
    hasQuery.value
    && !isSearching.value
    && !isCommandMode.value
    && !isSpaceMode.value
    && !hasSearchResults.value
    && createFallbackResults.value.length > 0,
)

const isEmpty = computed(() => {
  if (!hasQuery.value || isSearching.value) {
    return false
  }

  if (showCreateFallbacks.value) {
    return false
  }

  if (isScopedSearch.value) {
    return contentResults.value.length === 0
  }

  if (isSpaceMode.value) {
    return matchedSpaceResults.value.length === 0
  }

  return (
    matchedCommandResults.value.length === 0
    && (isCommandMode.value
      || (matchedSpaceResults.value.length === 0
        && contentResults.value.length === 0))
  )
})

const showRootResults = computed(
  () =>
    !hasQuery.value
    && !isCommandMode.value
    && !isSpaceMode.value
    && !isScopedSearch.value,
)
const showScopedHome = computed(() => isScopedSearch.value && !hasQuery.value)
const isPendingContentSearch = computed(
  () =>
    isSearching.value
    && hasQuery.value
    && !isCommandMode.value
    && !isSpaceMode.value,
)
const showPendingRootResults = computed(
  () =>
    isPendingContentSearch.value
    && !isScopedSearch.value
    && contentResults.value.length === 0,
)
const showPendingScopedHome = computed(
  () =>
    isPendingContentSearch.value
    && isScopedSearch.value
    && contentResults.value.length === 0,
)

const rootResults = computed<CommandPaletteResult[]>(() => [
  ...recentResults.value,
  ...commandResults.value,
  ...spaceResults.value,
])

const visibleResults = computed<CommandPaletteResult[]>(() => {
  if (showRootResults.value) {
    return rootResults.value
  }

  if (showPendingRootResults.value) {
    return rootResults.value
  }

  if (isCommandMode.value) {
    return matchedCommandResults.value
  }

  if (isSpaceMode.value) {
    return matchedSpaceResults.value
  }

  if (showScopedHome.value || showPendingScopedHome.value) {
    return scopedRecentResults.value
  }

  if (isPendingContentSearch.value) {
    return contentResults.value
  }

  if (showCreateFallbacks.value) {
    return createFallbackResults.value
  }

  if (isScopedSearch.value) {
    return contentResults.value
  }

  return [
    ...primaryCommandResults.value,
    ...primarySpaceResults.value,
    ...contentResults.value,
    ...secondaryCommandResults.value,
    ...secondarySpaceResults.value,
  ]
})

const activeResultId = computed(
  () => visibleResults.value[activeIndex.value]?.id,
)
const actionPanelTarget = ref<CommandPaletteResult>()
const actionPanelActions = computed<CommandPaletteAction[]>(() =>
  actionPanelTarget.value ? getActionPanelActions(actionPanelTarget.value) : [],
)
const activeActionId = computed(
  () => actionPanelActions.value[activeActionIndex.value]?.id,
)
const modifierKeyLabel = computed(() =>
  navigator.platform.toLowerCase().includes('mac') ? '⌘' : 'Ctrl',
)
const footerHints = computed<CommandPaletteFooterHint[]>(() =>
  isActionPanelOpen.value
    ? [
        {
          label: i18n.t('commandPalette.footer.run'),
          keys: ['↵'],
        },
        {
          label: i18n.t('commandPalette.footer.back'),
          keys: ['←'],
        },
      ]
    : [
        {
          label: i18n.t('commandPalette.footer.open'),
          keys: ['↵'],
        },
        {
          label: i18n.t('commandPalette.footer.actions'),
          keys: [`${modifierKeyLabel.value}K`],
        },
      ],
)

function getActionPanelActions(result: CommandPaletteResult) {
  const actions: CommandPaletteAction[] = [
    {
      id: 'open',
      title:
        result.type === 'command'
          ? i18n.t('commandPalette.actionPanel.run')
          : i18n.t('commandPalette.actionPanel.open'),
      subtitle: result.title,
      icon: result.icon,
      run: () => selectResult(result),
    },
    {
      id: 'copy-title',
      title: i18n.t('commandPalette.actionPanel.copyTitle'),
      subtitle: result.title,
      icon: Copy,
      run: () => copyToClipboard(result.title),
      closeOnRun: true,
    },
  ]

  if (hasSnippetContentAction(result)) {
    actions.push({
      id: 'copy-snippet-content',
      title: i18n.t('commandPalette.actionPanel.copySnippetContent'),
      subtitle: result.title,
      icon: Copy,
      run: () => copySnippetContent(result),
      closeOnRun: true,
    })
  }

  if (hasNoteContentAction(result)) {
    actions.push({
      id: 'copy-note-content',
      title: i18n.t('action.copy.note'),
      subtitle: result.title,
      icon: Copy,
      run: () => copyNoteContent(result),
      closeOnRun: true,
    })
  }

  if (hasHttpRequestCopyAction(result)) {
    actions.push({
      id: 'copy-http-request',
      title: i18n.t('action.copy.request'),
      subtitle: result.title,
      icon: Copy,
      run: () => copyHttpRequest(result),
      closeOnRun: true,
    })
  }

  if (hasItemLinkAction(result)) {
    const payload = getItemPayload(result)

    if (payload) {
      actions.push({
        id: 'copy-item-link',
        title: getCopyLinkActionTitle(payload.target),
        subtitle: result.title,
        icon: Copy,
        run: () => copyItemLink(result),
        closeOnRun: true,
      })
    }
  }

  if (hasRevealInFileManagerAction(result)) {
    actions.push({
      id: 'reveal-in-file-manager',
      title: getRevealInFileManagerLabel(),
      subtitle: result.title,
      icon: FolderOpen,
      run: () => revealInFileManager(result),
      closeOnRun: true,
    })
  }

  if (result.type === 'http-request' && result.item.url) {
    actions.push({
      id: 'copy-http-url',
      title: i18n.t('commandPalette.actionPanel.copyHttpUrl'),
      subtitle: result.item.url,
      icon: Copy,
      run: () => copyToClipboard(result.item.url),
      closeOnRun: true,
    })
  }

  return actions
}

function getRevealInFileManagerLabel() {
  return isMac
    ? i18n.t('action.reveal.inFinder')
    : i18n.t('action.reveal.inFileManager')
}

function hasSnippetContentAction(result: CommandPaletteResult) {
  if (result.type === 'snippet') {
    return Boolean(getSnippetContentValue(result.item))
  }

  return result.type === 'recent' && result.recent.target === 'snippet'
}

function hasNoteContentAction(result: CommandPaletteResult) {
  return result.type === 'note' || isRecentTarget(result, 'note')
}

function hasHttpRequestCopyAction(result: CommandPaletteResult) {
  return (
    result.type === 'http-request' || isRecentTarget(result, 'http-request')
  )
}

function hasItemLinkAction(result: CommandPaletteResult) {
  return Boolean(getItemPayload(result))
}

function isRecentTarget(result: CommandPaletteResult, target: ItemResultType) {
  return result.type === 'recent' && result.recent.target === target
}

function getSnippetContentValue(snippet: SnippetContentSource) {
  return snippet.contents.find(content => content.value?.trim())?.value
}

async function copySnippetContent(result: CommandPaletteResult) {
  if (result.type === 'snippet') {
    const content = getSnippetContentValue(result.item)

    if (content) {
      copyToClipboard(content)
    }

    return
  }

  if (result.type !== 'recent' || result.recent.target !== 'snippet') {
    return
  }

  const { data } = await api.snippets.getSnippetsById(result.recent.targetId)
  const content = getSnippetContentValue(data)

  if (content) {
    copyToClipboard(content)
  }
}

async function copyNoteContent(result: CommandPaletteResult) {
  if (result.type === 'note') {
    copyToClipboard(result.item.content)
    return
  }

  if (!isRecentTarget(result, 'note')) {
    return
  }

  const { data } = await api.notes.getNotesById(result.recent.targetId)
  copyToClipboard(data.content)
}

async function copyHttpRequest(result: CommandPaletteResult) {
  const request = await getHttpRequest(result)

  if (!request) {
    return
  }

  copyToClipboard(
    buildHttpPreview(request, {
      variables:
        (activeEnvironment.value?.variables as Record<string, string>) ?? {},
    }),
  )
}

async function getHttpRequest(result: CommandPaletteResult) {
  if (result.type === 'http-request') {
    return result.item
  }

  if (!isRecentTarget(result, 'http-request')) {
    return null
  }

  const { data } = await api.httpRequests.getHttpRequestsById(
    result.recent.targetId,
  )

  return data
}

function hasRevealInFileManagerAction(result: CommandPaletteResult) {
  return Boolean(getItemPayload(result))
}

function isRevealableRecentTarget(
  target: RecentTarget,
): target is ItemResultType {
  return target === 'snippet' || target === 'note' || target === 'http-request'
}

function getItemPayload(result: CommandPaletteResult) {
  if (
    result.type === 'snippet'
    || result.type === 'note'
    || result.type === 'http-request'
  ) {
    return {
      target: result.type,
      targetId: String(result.item.id),
    }
  }

  if (
    result.type === 'recent'
    && isRevealableRecentTarget(result.recent.target)
  ) {
    return {
      target: result.recent.target,
      targetId: result.recent.targetId,
    }
  }

  return null
}

function getCopyLinkActionTitle(target: ItemResultType) {
  if (target === 'snippet') {
    return i18n.t('action.copy.snippetLink')
  }

  if (target === 'note') {
    return i18n.t('action.copy.noteLink')
  }

  return i18n.t('action.copy.requestLink')
}

function copyItemLink(result: CommandPaletteResult) {
  const payload = getItemPayload(result)

  if (!payload) {
    return
  }

  if (payload.target === 'snippet') {
    copyToClipboard(`masscode://goto?snippetId=${payload.targetId}`)
  }
  else if (payload.target === 'note') {
    copyToClipboard(`masscode://goto?noteId=${payload.targetId}`)
  }
  else {
    copyToClipboard(`masscode://goto?httpRequestId=${payload.targetId}`)
  }
}

function revealInFileManager(result: CommandPaletteResult) {
  const payload = getItemPayload(result)

  if (!payload) {
    return
  }

  const targetId = Number(payload.targetId)

  if (payload.target === 'snippet') {
    void ipc.invoke('system:show-snippet-in-file-manager', targetId)
  }
  else if (payload.target === 'note') {
    void ipc.invoke('system:show-note-in-file-manager', targetId)
  }
  else {
    void ipc.invoke('system:show-http-request-in-file-manager', targetId)
  }
}

function onQueryChange(value: string) {
  closeActionPanel()
  activeIndex.value = 0
  activeNavigationDirection.value = 0
  setQuery(value)
}

function openActionPanel() {
  const result = visibleResults.value[activeIndex.value]

  if (!result || isSearching.value) {
    return
  }

  actionPanelTarget.value = result
  isActionPanelOpen.value = true
  activeActionIndex.value = 0
}

function closeActionPanel() {
  isActionPanelOpen.value = false
  activeActionIndex.value = 0
  activeNavigationDirection.value = 0
  actionPanelTarget.value = undefined
}

function setActiveAction(action: CommandPaletteAction) {
  const index = actionPanelActions.value.findIndex(
    item => item.id === action.id,
  )

  if (index >= 0) {
    activeNavigationDirection.value = 0
    activeActionIndex.value = index
  }
}

function moveActiveActionIndex(step: number) {
  if (!actionPanelActions.value.length) {
    activeActionIndex.value = 0
    activeNavigationDirection.value = 0
    return
  }

  activeNavigationDirection.value = step > 0 ? 1 : -1
  activeActionIndex.value
    = (activeActionIndex.value + step + actionPanelActions.value.length)
      % actionPanelActions.value.length
}

async function runAction(action: CommandPaletteAction) {
  if (isOpeningResult.value) {
    return
  }

  await action.run()

  if (action.closeOnRun) {
    isOpen.value = false
  }
}

function setActiveResult(result: CommandPaletteResult) {
  const index = visibleResults.value.findIndex(item => item.id === result.id)
  if (index >= 0) {
    activeNavigationDirection.value = 0
    activeIndex.value = index
  }
}

async function selectResult(result: CommandPaletteResult) {
  if (isSpaceMode.value && result.type === 'space') {
    selectSearchScope(result.spaceId)
    activeIndex.value = 0
    activeNavigationDirection.value = 0
    return
  }

  if (
    isOpeningResult.value
    || (isSearching.value && !isLocalResult(result))
    || !visibleResults.value.some(item => item.id === result.id)
  ) {
    return
  }

  isOpeningResult.value = true

  try {
    await openResult(result)
  }
  finally {
    isOpeningResult.value = false
  }
}

function moveActiveIndex(step: number) {
  if (!visibleResults.value.length) {
    activeIndex.value = 0
    activeNavigationDirection.value = 0
    return
  }

  activeNavigationDirection.value = step > 0 ? 1 : -1
  activeIndex.value
    = (activeIndex.value + step + visibleResults.value.length)
      % visibleResults.value.length
}

async function scrollActiveResultIntoView() {
  await nextTick()

  const activeElement = document.querySelector<HTMLElement>(
    '[data-command-palette-active="true"]',
  )
  const listElement = document.querySelector<HTMLElement>(
    '[data-slot="command-list"]',
  )

  if (!activeElement || !listElement) {
    return
  }

  const activeRect = activeElement.getBoundingClientRect()
  const listRect = listElement.getBoundingClientRect()
  const activeTop = activeRect.top - listRect.top + listElement.scrollTop
  const activeBottom = activeTop + activeRect.height
  const visibleTop = listElement.scrollTop
  const visibleBottom = visibleTop + listElement.clientHeight

  if (activeNavigationDirection.value > 0 && activeBottom > visibleBottom) {
    listElement.scrollTop = activeBottom - listElement.clientHeight
    return
  }

  if (activeNavigationDirection.value < 0 && activeTop < visibleTop) {
    listElement.scrollTop = activeTop
    return
  }

  if (activeTop < visibleTop) {
    listElement.scrollTop = activeTop
    return
  }

  if (activeBottom > visibleBottom) {
    listElement.scrollTop = activeBottom - listElement.clientHeight
  }
}

async function moveCommandModeCaretToEnd() {
  await nextTick()

  if (commandModeCaretFrame !== undefined) {
    cancelAnimationFrame(commandModeCaretFrame)
  }

  commandModeCaretFrame = requestAnimationFrame(() => {
    commandModeCaretFrame = undefined

    if (!isOpen.value || query.value !== '>') {
      return
    }

    const input = document.querySelector<HTMLInputElement>(
      '[data-slot="command-input"]',
    )

    if (!input || input.value !== '>') {
      return
    }

    input.focus()
    input.setSelectionRange(input.value.length, input.value.length)
  })
}

function onInputKeydown(event: KeyboardEvent) {
  if (event.isComposing) {
    return
  }

  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    event.stopPropagation()

    if (!isActionPanelOpen.value) {
      openActionPanel()
    }

    return
  }

  if (isActionPanelOpen.value) {
    if (event.key === 'Escape' || event.key === 'ArrowLeft') {
      event.preventDefault()
      event.stopPropagation()
      closeActionPanel()
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      event.stopPropagation()
      moveActiveActionIndex(1)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      event.stopPropagation()
      moveActiveActionIndex(-1)
      return
    }

    if (event.key !== 'Enter') {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    const action = actionPanelActions.value[activeActionIndex.value]

    if (action) {
      runAction(action)
    }

    return
  }

  if (event.key === 'Escape' && isScopedSearch.value) {
    event.preventDefault()
    event.stopPropagation()
    activeIndex.value = 0
    activeNavigationDirection.value = 0
    clearSearchScope()
    return
  }

  if (event.key === 'Escape' && (isCommandMode.value || isSpaceMode.value)) {
    event.preventDefault()
    event.stopPropagation()
    activeIndex.value = 0
    activeNavigationDirection.value = 0
    setQuery('')
    return
  }

  if (event.key === 'Backspace' && isScopedSearch.value && !query.value) {
    event.preventDefault()
    event.stopPropagation()
    activeIndex.value = 0
    activeNavigationDirection.value = 0
    clearSearchScope()
    return
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    event.stopPropagation()
    moveActiveIndex(1)
    return
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    event.stopPropagation()
    moveActiveIndex(-1)
    return
  }

  if (event.key === 'ArrowRight') {
    event.preventDefault()
    event.stopPropagation()
    openActionPanel()
    return
  }

  if (event.key !== 'Enter') {
    return
  }

  event.preventDefault()
  event.stopPropagation()

  if (event.shiftKey && showCreateFallbacks.value) {
    const fallbackResult = createFallbackResults.value[0]
    if (fallbackResult) {
      selectResult(fallbackResult)
    }
    return
  }

  const result = visibleResults.value[activeIndex.value]

  if (!result) {
    return
  }

  if (isSearching.value && !isLocalResult(result)) {
    return
  }

  selectResult(result)
}

watch(
  visibleResults,
  (results) => {
    if (isSearching.value) {
      activeIndex.value = 0
      activeNavigationDirection.value = 0
      return
    }

    if (!results.length) {
      activeIndex.value = 0
      activeNavigationDirection.value = 0
      return
    }

    if (activeIndex.value >= results.length) {
      activeIndex.value = 0
      activeNavigationDirection.value = 0
    }
  },
  { immediate: true },
)

watch(isOpen, () => {
  activeIndex.value = 0
  activeNavigationDirection.value = 0
  closeActionPanel()
})

watch(actionPanelActions, (actions) => {
  if (!actions.length) {
    closeActionPanel()
    return
  }

  if (activeActionIndex.value >= actions.length) {
    activeActionIndex.value = 0
    activeNavigationDirection.value = 0
  }
})

watch([isOpen, query], () => {
  if (isOpen.value && query.value === '>') {
    moveCommandModeCaretToEnd()
  }
})

watch(isActionPanelOpen, () => {
  if (isOpen.value) {
    scrollActiveResultIntoView()
  }
})

watch(activeResultId, () => {
  if (isOpen.value) {
    scrollActiveResultIntoView()
  }
})

watch(activeActionId, () => {
  if (isOpen.value && isActionPanelOpen.value) {
    scrollActiveResultIntoView()
  }
})
</script>

<template>
  <Command.CommandDialog
    v-model:open="isOpen"
    :title="i18n.t('commandPalette.title')"
    :description="i18n.t('commandPalette.description')"
    :show-close-button="false"
  >
    <Command.CommandInput
      :model-value="query"
      :is-loading="isSearching"
      :placeholder="inputPlaceholder"
      :scope-label="searchScopeLabel"
      :scope-clear-label="i18n.t('commandPalette.clearScope')"
      @clear-scope="clearSearchScope"
      @update:model-value="onQueryChange"
      @keydown.capture="onInputKeydown"
    />
    <Command.CommandList class="h-[392px] max-h-none">
      <template v-if="isActionPanelOpen">
        <Command.CommandGroup
          force-visible
          :heading="i18n.t('commandPalette.actionPanel.heading')"
        >
          <button
            v-for="action in actionPanelActions"
            :key="action.id"
            type="button"
            role="option"
            :aria-selected="activeActionId === action.id"
            :data-command-palette-active="
              activeActionId === action.id ? 'true' : undefined
            "
            class="[&_svg:not([class*='text-'])]:text-muted-foreground relative flex min-h-11 w-full cursor-default items-start gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-hidden select-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
            :class="
              activeActionId === action.id
                ? 'bg-accent text-accent-foreground'
                : ''
            "
            @click="runAction(action)"
            @pointerenter="setActiveAction(action)"
          >
            <component
              :is="action.icon"
              class="mt-[2px] h-4 w-4"
            />
            <div class="min-w-0 flex-1">
              <UiText
                as="div"
                variant="sm"
                weight="medium"
                class="truncate"
              >
                {{ action.title }}
              </UiText>
              <UiText
                as="div"
                variant="caption"
                class="text-muted-foreground truncate"
              >
                {{ action.subtitle }}
              </UiText>
            </div>
          </button>
        </Command.CommandGroup>
      </template>

      <template v-else>
        <div
          v-if="isEmpty"
          class="text-muted-foreground py-6 text-center text-sm"
        >
          {{ i18n.t("commandPalette.empty") }}
        </div>

        <div
          v-if="showCreateFallbacks"
          class="text-muted-foreground px-3 pt-6 pb-2 text-center text-sm"
        >
          {{ i18n.t("commandPalette.empty") }}
        </div>

        <Command.CommandGroup
          v-if="showCreateFallbacks"
          force-visible
          :heading="i18n.t('commandPalette.groups.actions')"
        >
          <CommandPaletteItem
            v-for="result in createFallbackResults"
            :key="result.id"
            :result="result"
            :active="activeResultId === result.id"
            @activate="setActiveResult"
            @select="selectResult"
          />
        </Command.CommandGroup>

        <Command.CommandGroup
          v-if="
            (showRootResults || showPendingRootResults) && recentResults.length
          "
          force-visible
          :heading="i18n.t('commandPalette.groups.recent')"
        >
          <CommandPaletteItem
            v-for="result in recentResults"
            :key="result.id"
            :result="result"
            :active="activeResultId === result.id"
            @activate="setActiveResult"
            @select="selectResult"
          />
        </Command.CommandGroup>

        <Command.CommandGroup
          v-if="
            (showRootResults || showPendingRootResults) && commandResults.length
          "
          force-visible
          :heading="i18n.t('commandPalette.groups.actions')"
        >
          <CommandPaletteItem
            v-for="result in commandResults"
            :key="result.id"
            :result="result"
            :active="activeResultId === result.id"
            @activate="setActiveResult"
            @select="selectResult"
          />
        </Command.CommandGroup>

        <Command.CommandGroup
          v-if="showRootResults || showPendingRootResults"
          force-visible
          :heading="i18n.t('commandPalette.groups.spaces')"
        >
          <CommandPaletteItem
            v-for="result in spaceResults"
            :key="result.id"
            :result="result"
            :active="activeResultId === result.id"
            @activate="setActiveResult"
            @select="selectResult"
          />
        </Command.CommandGroup>

        <Command.CommandGroup
          v-if="
            (showScopedHome || showPendingScopedHome)
              && scopedRecentResults.length
          "
          force-visible
          :heading="i18n.t('commandPalette.groups.recent')"
        >
          <CommandPaletteItem
            v-for="result in scopedRecentResults"
            :key="result.id"
            :result="result"
            :active="activeResultId === result.id"
            @activate="setActiveResult"
            @select="selectResult"
          />
        </Command.CommandGroup>

        <Command.CommandGroup
          v-if="isSpaceMode && matchedSpaceResults.length"
          force-visible
          :heading="i18n.t('commandPalette.groups.spaces')"
        >
          <CommandPaletteItem
            v-for="result in matchedSpaceResults"
            :key="result.id"
            :result="result"
            :active="activeResultId === result.id"
            @activate="setActiveResult"
            @select="selectResult"
          />
        </Command.CommandGroup>

        <Command.CommandGroup
          v-if="isCommandMode && matchedCommandResults.length"
          force-visible
          :heading="i18n.t('commandPalette.groups.actions')"
        >
          <CommandPaletteItem
            v-for="result in matchedCommandResults"
            :key="result.id"
            :result="result"
            :active="activeResultId === result.id"
            @activate="setActiveResult"
            @select="selectResult"
          />
        </Command.CommandGroup>

        <Command.CommandGroup
          v-if="
            !isCommandMode
              && !isSpaceMode
              && !isScopedSearch
              && hasQuery
              && !isSearching
              && primaryCommandResults.length
          "
          force-visible
          :heading="i18n.t('commandPalette.groups.actions')"
        >
          <CommandPaletteItem
            v-for="result in primaryCommandResults"
            :key="result.id"
            :result="result"
            :active="activeResultId === result.id"
            @activate="setActiveResult"
            @select="selectResult"
          />
        </Command.CommandGroup>

        <Command.CommandGroup
          v-if="
            !isCommandMode
              && !isSpaceMode
              && !isScopedSearch
              && hasQuery
              && !isSearching
              && primarySpaceResults.length
          "
          force-visible
          :heading="i18n.t('commandPalette.groups.spaces')"
        >
          <CommandPaletteItem
            v-for="result in primarySpaceResults"
            :key="result.id"
            :result="result"
            :active="activeResultId === result.id"
            @activate="setActiveResult"
            @select="selectResult"
          />
        </Command.CommandGroup>

        <Command.CommandGroup
          v-if="
            !isCommandMode && !isSpaceMode && hasQuery && contentResults.length
          "
          force-visible
          :heading="i18n.t('commandPalette.groups.results')"
        >
          <CommandPaletteItem
            v-for="result in contentResults"
            :key="result.id"
            :result="result"
            :active="activeResultId === result.id"
            @activate="setActiveResult"
            @select="selectResult"
          />
        </Command.CommandGroup>

        <Command.CommandGroup
          v-if="
            !isCommandMode
              && !isSpaceMode
              && !isScopedSearch
              && hasQuery
              && !isSearching
              && secondaryCommandResults.length
          "
          force-visible
          :heading="i18n.t('commandPalette.groups.actions')"
        >
          <CommandPaletteItem
            v-for="result in secondaryCommandResults"
            :key="result.id"
            :result="result"
            :active="activeResultId === result.id"
            @activate="setActiveResult"
            @select="selectResult"
          />
        </Command.CommandGroup>

        <Command.CommandGroup
          v-if="
            !isCommandMode
              && !isSpaceMode
              && !isScopedSearch
              && hasQuery
              && !isSearching
              && secondarySpaceResults.length
          "
          force-visible
          :heading="i18n.t('commandPalette.groups.spaces')"
        >
          <CommandPaletteItem
            v-for="result in secondarySpaceResults"
            :key="result.id"
            :result="result"
            :active="activeResultId === result.id"
            @activate="setActiveResult"
            @select="selectResult"
          />
        </Command.CommandGroup>
      </template>
    </Command.CommandList>
    <div
      class="border-border text-muted-foreground flex h-7 items-center justify-end gap-3 border-t px-3 text-xs"
    >
      <div
        v-for="hint in footerHints"
        :key="hint.label"
        class="flex items-center gap-1.5"
      >
        <span>{{ hint.label }}</span>
        <span class="flex items-center gap-0.5">
          <kbd
            v-for="key in hint.keys"
            :key="key"
            class="bg-muted text-muted-foreground min-w-5 rounded-sm px-1.5 py-0.5 text-center font-sans text-[11px] leading-none"
          >
            {{ key }}
          </kbd>
        </span>
      </div>
    </div>
  </Command.CommandDialog>
</template>
