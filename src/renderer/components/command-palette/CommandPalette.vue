<script setup lang="ts">
import * as Command from '@/components/ui/shadcn/command'
import {
  type CommandPaletteUsageScoreEntry,
  getCommandPaletteResultScore,
} from '@/composables/command-palette/ranking'
import {
  type CommandPaletteResult,
  useCommandPalette,
} from '@/composables/useCommandPalette'
import { i18n } from '@/electron'

const {
  commandResults,
  contentResults,
  hasQuery,
  isOpen,
  isSearching,
  openResult,
  query,
  recentResults,
  setQuery,
  spaceResults,
  usageById,
} = useCommandPalette()

const isOpeningResult = ref(false)
const activeIndex = ref(0)
let commandModeCaretFrame: number | undefined

const normalizedQuery = computed(() => query.value.trim().toLowerCase())
const isCommandMode = computed(() => query.value.startsWith('>'))
const normalizedSearchQuery = computed(() =>
  isCommandMode.value
    ? query.value.slice(1).trim().toLowerCase()
    : normalizedQuery.value,
)

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
  rankLocalResults(spaceResults.value.filter(matchesQuery)),
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

const isEmpty = computed(
  () =>
    hasQuery.value
    && !isSearching.value
    && matchedCommandResults.value.length === 0
    && (isCommandMode.value
      || (matchedSpaceResults.value.length === 0
        && contentResults.value.length === 0)),
)

const showRootResults = computed(() => !hasQuery.value && !isCommandMode.value)

const rootResults = computed<CommandPaletteResult[]>(() => [
  ...recentResults.value,
  ...commandResults.value,
  ...spaceResults.value,
])

const visibleResults = computed<CommandPaletteResult[]>(() => {
  if (showRootResults.value) {
    return rootResults.value
  }

  if (isCommandMode.value) {
    return matchedCommandResults.value
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

function onQueryChange(value: string) {
  activeIndex.value = 0
  setQuery(value)
}

function setActiveResult(result: CommandPaletteResult) {
  const index = visibleResults.value.findIndex(item => item.id === result.id)
  if (index >= 0) {
    activeIndex.value = index
  }
}

async function selectResult(result: CommandPaletteResult) {
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
    return
  }

  activeIndex.value
    = (activeIndex.value + step + visibleResults.value.length)
      % visibleResults.value.length
}

async function scrollActiveResultIntoView() {
  await nextTick()

  document
    .querySelector('[data-command-palette-active="true"]')
    ?.scrollIntoView({ block: 'nearest' })
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

  if (event.key === 'Escape' && isCommandMode.value) {
    event.preventDefault()
    event.stopPropagation()
    activeIndex.value = 0
    setQuery('')
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

  if (event.key !== 'Enter') {
    return
  }

  event.preventDefault()
  event.stopPropagation()

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
      return
    }

    if (!results.length) {
      activeIndex.value = 0
      return
    }

    if (activeIndex.value >= results.length) {
      activeIndex.value = 0
    }
  },
  { immediate: true },
)

watch(isOpen, () => {
  activeIndex.value = 0
})

watch([isOpen, query], () => {
  if (isOpen.value && query.value === '>') {
    moveCommandModeCaretToEnd()
  }
})

watch(activeResultId, () => {
  if (isOpen.value) {
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
      :placeholder="i18n.t('commandPalette.placeholder')"
      @update:model-value="onQueryChange"
      @keydown.capture="onInputKeydown"
    />
    <Command.CommandList class="h-[420px] max-h-none">
      <div
        v-if="isEmpty"
        class="text-muted-foreground py-6 text-center text-sm"
      >
        {{ i18n.t("commandPalette.empty") }}
      </div>

      <Command.CommandGroup
        v-if="showRootResults && recentResults.length"
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
        v-if="showRootResults && commandResults.length"
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
        v-if="showRootResults"
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
        v-if="!isCommandMode && hasQuery && primaryCommandResults.length"
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
        v-if="!isCommandMode && hasQuery && primarySpaceResults.length"
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
        v-if="!isCommandMode && hasQuery && contentResults.length"
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
        v-if="!isCommandMode && hasQuery && secondaryCommandResults.length"
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
        v-if="!isCommandMode && hasQuery && secondarySpaceResults.length"
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
    </Command.CommandList>
  </Command.CommandDialog>
</template>
