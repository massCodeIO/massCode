<script setup lang="ts">
import * as Command from '@/components/ui/shadcn/command'
import {
  type CommandPaletteResult,
  useCommandPalette,
} from '@/composables/useCommandPalette'
import { i18n } from '@/electron'

const {
  commandResults,
  hasQuery,
  httpRequestResults,
  isOpen,
  isSearching,
  noteResults,
  openResult,
  query,
  recentResults,
  setQuery,
  snippetResults,
  spaceResults,
} = useCommandPalette()

const isOpeningResult = ref(false)
const activeIndex = ref(0)

const isEmpty = computed(
  () =>
    hasQuery.value
    && !isSearching.value
    && snippetResults.value.length === 0
    && noteResults.value.length === 0
    && httpRequestResults.value.length === 0,
)

const hasSearchResults = computed(
  () =>
    snippetResults.value.length > 0
    || noteResults.value.length > 0
    || httpRequestResults.value.length > 0,
)

const showSpaceResults = computed(
  () => !hasQuery.value || (isSearching.value && !hasSearchResults.value),
)

const rootResults = computed<CommandPaletteResult[]>(() => [
  ...recentResults.value,
  ...commandResults.value,
  ...spaceResults.value,
])

const visibleResults = computed<CommandPaletteResult[]>(() => {
  if (showSpaceResults.value) {
    return rootResults.value
  }

  return [
    ...snippetResults.value,
    ...noteResults.value,
    ...httpRequestResults.value,
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
    || isSearching.value
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

function onInputKeydown(event: KeyboardEvent) {
  if (event.isComposing) {
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

  if (isSearching.value) {
    return
  }

  const result = visibleResults.value[activeIndex.value]

  if (!result) {
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
    <Command.CommandList class="max-h-[420px] min-h-[236px]">
      <div
        v-if="isEmpty"
        class="text-muted-foreground py-6 text-center text-sm"
      >
        {{ i18n.t("commandPalette.empty") }}
      </div>

      <Command.CommandGroup
        v-if="showSpaceResults && recentResults.length"
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
        v-if="showSpaceResults && commandResults.length"
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
        v-if="showSpaceResults"
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
        v-if="hasQuery && snippetResults.length"
        force-visible
        :heading="i18n.t('commandPalette.groups.snippets')"
      >
        <CommandPaletteItem
          v-for="result in snippetResults"
          :key="result.id"
          :result="result"
          :active="activeResultId === result.id"
          @activate="setActiveResult"
          @select="selectResult"
        />
      </Command.CommandGroup>

      <Command.CommandGroup
        v-if="hasQuery && noteResults.length"
        force-visible
        :heading="i18n.t('commandPalette.groups.notes')"
      >
        <CommandPaletteItem
          v-for="result in noteResults"
          :key="result.id"
          :result="result"
          :active="activeResultId === result.id"
          @activate="setActiveResult"
          @select="selectResult"
        />
      </Command.CommandGroup>

      <Command.CommandGroup
        v-if="hasQuery && httpRequestResults.length"
        force-visible
        :heading="i18n.t('commandPalette.groups.httpRequests')"
      >
        <CommandPaletteItem
          v-for="result in httpRequestResults"
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
