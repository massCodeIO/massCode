<script setup lang="ts">
import {
  type FolderIconFilter,
  type FolderIconSource,
  getFilteredFolderIcons,
  groupFolderIcons,
} from '@/components/ui/folder-icon/icons'
import { i18n } from '@/electron'
import { useFolders } from '~/renderer/composables'

interface Props {
  nodeId: number
  onSetIcon?: (nodeId: number, iconName: string) => Promise<void>
}

const props = defineProps<Props>()

const { updateFolder, getFolders } = useFolders()

const search = ref('')
const filter = ref<FolderIconFilter>('material')

const containerRef = useTemplateRef('containerRef')
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

const selectedIndex = ref(-1)

function onKeydown(e: KeyboardEvent) {
  const len = visibleIcons.value.length

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (selectedIndex.value + 1 < len) {
      selectedIndex.value += 1
    }
  }
  else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (selectedIndex.value - 1 >= 0) {
      selectedIndex.value -= 1
    }
  }
  else if (e.key === 'Enter') {
    e.preventDefault()

    const icon = visibleIcons.value[selectedIndex.value]

    if (icon) {
      onSet(icon.value)
    }
  }
}

function getSectionTitle(source: FolderIconSource) {
  return i18n.t(`folder.iconPicker.filters.${source}`)
}

async function onSet(value: string) {
  if (!props.nodeId)
    return

  if (props.onSetIcon) {
    await props.onSetIcon(props.nodeId, value)
  }
  else {
    await updateFolder(props.nodeId, { icon: value })
    await getFolders()
  }

  containerRef.value?.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
  )
}

watch(search, () => {
  selectedIndex.value = -1
})

watch(filter, () => {
  selectedIndex.value = -1
  nextTick(() => {
    listRef.value?.scrollTo({ top: 0 })
  })
})

watch(
  visibleIcons,
  () => {
    if (selectedIndex.value >= visibleIcons.value.length) {
      selectedIndex.value = -1
    }
  },
  { immediate: true },
)

watch(selectedIndex, () => {
  if (selectedIndex.value >= 0) {
    const el = document.getElementById(`icon-${selectedIndex.value}`)
    el?.scrollIntoView({
      behavior: 'auto',
      block: 'nearest',
    })
  }
})
</script>

<template>
  <div
    ref="containerRef"
    class="space-y-5"
  >
    <div class="space-y-3">
      <UiInput
        v-model="search"
        :placeholder="i18n.t('folder.iconPicker.searchPlaceholder')"
        @keydown="onKeydown"
      />
      <UiShadcnTabs
        v-model="filter"
        class="gap-0"
      >
        <UiShadcnTabsList>
          <UiShadcnTabsTrigger
            v-for="item in filterOptions"
            :key="item.value"
            :value="item.value"
          >
            {{ item.label }}
          </UiShadcnTabsTrigger>
        </UiShadcnTabsList>
      </UiShadcnTabs>
    </div>
    <div
      ref="listRef"
      class="scrollbar max-h-[280px] overflow-y-auto"
    >
      <div
        v-if="iconSections.length"
        class="space-y-4"
      >
        <div
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
            <div
              v-for="icon in section.items"
              :id="`icon-${visibleIcons.findIndex((item) => item.value === icon.value)}`"
              :key="icon.value"
              class="user-select-none flex items-center justify-center rounded-md"
              :class="
                visibleIcons[selectedIndex]?.value === icon.value
                  ? 'bg-muted'
                  : 'hover:bg-muted'
              "
              @click="onSet(icon.value)"
            >
              <UiFolderIcon
                :name="icon.value"
                class="size-5"
              />
            </div>
          </div>
        </div>
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
