<script setup lang="ts">
import type {
  FolderIconFilter,
  FolderIconSource,
} from '@/components/ui/folder-icon/icons'
import {
  getFilteredFolderIcons,
  groupFolderIcons,
} from '@/components/ui/folder-icon/icons'
import { Button } from '@/components/ui/shadcn/button'
import * as Tabs from '@/components/ui/shadcn/tabs'
import { i18n } from '@/electron'

const emit = defineEmits<{
  select: [value: string]
}>()

const search = ref('')
const filter = ref<FolderIconFilter>('material')
const selectedIndex = ref(-1)
const listRef = useTemplateRef('listRef')

const filterOptions = computed<
  Array<{ label: string, value: FolderIconFilter }>
>(() => [
  { label: i18n.t('folder.iconPicker.filters.material'), value: 'material' },
  { label: i18n.t('folder.iconPicker.filters.lucide'), value: 'lucide' },
])
const visibleIcons = computed(() =>
  getFilteredFolderIcons(search.value, filter.value),
)
const iconSections = computed(() => groupFolderIcons(visibleIcons.value))

function getSectionTitle(source: FolderIconSource) {
  return i18n.t(`folder.iconPicker.filters.${source}`)
}

function onKeydown(event: KeyboardEvent) {
  if (
    !['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Enter'].includes(
      event.key,
    )
  ) {
    return
  }

  event.stopPropagation()
  const length = visibleIcons.value.length
  if (length === 0)
    return

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    selectedIndex.value
      = selectedIndex.value < 0
        ? 0
        : Math.min(selectedIndex.value + 8, length - 1)
  }
  else if (event.key === 'ArrowUp') {
    event.preventDefault()
    selectedIndex.value
      = selectedIndex.value < 0 ? 0 : Math.max(selectedIndex.value - 8, 0)
  }
  else if (event.key === 'ArrowRight') {
    event.preventDefault()
    selectedIndex.value
      = selectedIndex.value < 0
        ? 0
        : Math.min(selectedIndex.value + 1, length - 1)
  }
  else if (event.key === 'ArrowLeft') {
    event.preventDefault()
    selectedIndex.value
      = selectedIndex.value < 0 ? 0 : Math.max(selectedIndex.value - 1, 0)
  }
  else if (event.key === 'Enter') {
    event.preventDefault()
    const icon = visibleIcons.value[selectedIndex.value]
    if (icon)
      emit('select', icon.value)
  }
}

watch([search, filter], () => {
  selectedIndex.value = -1
  nextTick(() => listRef.value?.scrollTo({ top: 0 }))
})

watch(visibleIcons, () => {
  if (selectedIndex.value >= visibleIcons.value.length)
    selectedIndex.value = -1
})

watch(selectedIndex, () => {
  if (selectedIndex.value < 0)
    return

  document
    .getElementById(`folder-icon-${selectedIndex.value}`)
    ?.scrollIntoView({ behavior: 'auto', block: 'nearest' })
})
</script>

<template>
  <div class="space-y-3">
    <UiInput
      v-model="search"
      autofocus
      focus
      :placeholder="i18n.t('folder.iconPicker.iconSearchPlaceholder')"
      @keydown="onKeydown"
    />
    <Tabs.Tabs
      v-model="filter"
      class="gap-0"
    >
      <Tabs.TabsList>
        <Tabs.TabsTrigger
          v-for="item in filterOptions"
          :key="item.value"
          :value="item.value"
        >
          {{ item.label }}
        </Tabs.TabsTrigger>
      </Tabs.TabsList>
    </Tabs.Tabs>
    <div
      ref="listRef"
      class="scrollbar max-h-[240px] overflow-y-auto"
    >
      <div
        v-if="iconSections.length"
        class="space-y-4"
      >
        <section
          v-for="section in iconSections"
          :key="section.source"
          class="space-y-2"
        >
          <UiText
            as="div"
            variant="xs"
            weight="medium"
            muted
            uppercase
            class="px-1 tracking-[0.08em]"
          >
            {{ getSectionTitle(section.source) }}
          </UiText>
          <div class="grid auto-rows-[36px] grid-cols-8 gap-2">
            <Button
              v-for="icon in section.items"
              :id="`folder-icon-${visibleIcons.findIndex((item) => item.value === icon.value)}`"
              :key="icon.value"
              :aria-label="icon.name"
              class="size-9 px-0"
              :class="
                visibleIcons[selectedIndex]?.value === icon.value
                  ? 'bg-muted'
                  : ''
              "
              size="icon"
              type="button"
              variant="ghost"
              @click="emit('select', icon.value)"
            >
              <UiFolderIcon
                :name="icon.value"
                class="size-5"
              />
            </Button>
          </div>
        </section>
      </div>
      <div
        v-else
        class="flex min-h-24 items-center justify-center px-4 text-center"
      >
        <UiText
          variant="sm"
          muted
        >
          {{ i18n.t("folder.iconPicker.emptyResults") }}
        </UiText>
      </div>
    </div>
  </div>
</template>
