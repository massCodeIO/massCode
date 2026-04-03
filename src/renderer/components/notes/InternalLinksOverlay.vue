<script setup lang="ts">
import type { InternalLinkPickerItem } from './cm-extensions/internalLinks/trigger'
import * as Popover from '@/components/ui/shadcn/popover'
import { i18n } from '@/electron'
import { cn } from '@/utils'
import { useWindowSize } from '@vueuse/core'
import { Code2, FileText } from 'lucide-vue-next'
import {
  getInternalLinksPickerLayout,
  INTERNAL_LINKS_PICKER_WIDTH,
} from './cm-extensions/internalLinks/pickerLayout'
import {
  closeInternalLinksPreview,
  internalLinksPreviewState,
  onInternalLinksPreviewPopupEnter,
  onInternalLinksPreviewPopupLeave,
} from './cm-extensions/internalLinks/preview'
import {
  closeInternalLinksPicker,
  internalLinksPickerState,
  selectInternalLinksPickerItem,
} from './cm-extensions/internalLinks/trigger'

const { height: windowHeight, width: windowWidth } = useWindowSize()
const pickerListRef = ref<HTMLElement | null>(null)

const pickerLayout = computed(() => {
  if (!internalLinksPickerState.anchor) {
    return null
  }

  return getInternalLinksPickerLayout({
    anchor: internalLinksPickerState.anchor,
    viewport: {
      height: windowHeight.value,
      width: windowWidth.value,
    },
  })
})

const pickerAnchorStyle = computed(() => {
  if (!internalLinksPickerState.anchor || !pickerLayout.value) {
    return { display: 'none' }
  }

  return {
    left: `${pickerLayout.value.left}px`,
    top: `${internalLinksPickerState.anchor.top}px`,
  }
})

const pickerContentStyle = computed(() => {
  if (!pickerLayout.value) {
    return {}
  }

  return {
    maxHeight: `${pickerLayout.value.maxHeight}px`,
    width: `${INTERNAL_LINKS_PICKER_WIDTH}px`,
  }
})

const activePickerItem = computed(
  () =>
    internalLinksPickerState.items[internalLinksPickerState.activeIndex]
    ?? null,
)

const activePickerItemKey = computed(() =>
  activePickerItem.value ? getPickerItemKey(activePickerItem.value) : null,
)

const previewAnchorStyle = computed(() => {
  if (!internalLinksPreviewState.anchor) {
    return { display: 'none' }
  }

  return {
    left: `${internalLinksPreviewState.anchor.left}px`,
    top: `${internalLinksPreviewState.anchor.top}px`,
  }
})

const pickerGroups = computed(() => {
  const snippets = internalLinksPickerState.items.filter(
    item => item.type === 'snippet',
  )
  const notes = internalLinksPickerState.items.filter(
    item => item.type === 'note',
  )

  return [
    {
      items: snippets,
      key: 'snippet',
      title: i18n.t('internalLinks.picker.groups.snippets'),
    },
    {
      items: notes,
      key: 'note',
      title: i18n.t('internalLinks.picker.groups.notes'),
    },
  ].filter(group => group.items.length)
})

function getItemIcon(type: InternalLinkPickerItem['type']) {
  return type === 'snippet' ? Code2 : FileText
}

function getPickerItemKey(item: InternalLinkPickerItem) {
  return `${item.type}:${item.id}`
}

function setActivePickerItem(item: InternalLinkPickerItem) {
  const index = internalLinksPickerState.items.findIndex(
    current => current.id === item.id && current.type === item.type,
  )

  if (index === -1) {
    return
  }

  internalLinksPickerState.activeIndex = index
}

function onPickerInteractOutside() {
  closeInternalLinksPicker(true)
}

function onPreviewOpenUpdate(isOpen: boolean) {
  if (!isOpen) {
    closeInternalLinksPreview()
  }
}

watch(
  [() => internalLinksPickerState.isOpen, activePickerItemKey],
  async ([isOpen, itemKey]) => {
    if (!isOpen || !itemKey) {
      return
    }

    await nextTick()
    const item = pickerListRef.value?.querySelector<HTMLElement>(
      `[data-picker-item-key="${itemKey}"]`,
    )

    item?.scrollIntoView({ block: 'nearest' })
  },
)
</script>

<template>
  <Popover.Popover
    :open="internalLinksPickerState.isOpen"
    @update:open="(isOpen) => !isOpen && closeInternalLinksPicker(true)"
  >
    <Popover.PopoverAnchor as-child>
      <div
        class="pointer-events-none fixed z-40 size-px"
        :style="pickerAnchorStyle"
      />
    </Popover.PopoverAnchor>
    <Popover.PopoverContent
      align="start"
      :side="pickerLayout?.side ?? 'bottom'"
      :side-offset="8"
      class="p-0"
      :style="pickerContentStyle"
      @escape-key-down.prevent="closeInternalLinksPicker(true)"
      @interact-outside="onPickerInteractOutside"
      @open-auto-focus.prevent
    >
      <div
        class="bg-popover text-popover-foreground overflow-hidden rounded-md"
      >
        <div
          ref="pickerListRef"
          class="overflow-y-auto p-1.5"
          :style="{ maxHeight: pickerContentStyle.maxHeight }"
        >
          <template v-if="pickerGroups.length">
            <div
              v-for="group in pickerGroups"
              :key="group.key"
              class="mb-1 last:mb-0"
            >
              <div
                class="text-muted-foreground px-2 py-1.5 text-xs font-medium"
              >
                {{ group.title }}
              </div>

              <button
                v-for="item in group.items"
                :key="getPickerItemKey(item)"
                type="button"
                :data-picker-item-key="getPickerItemKey(item)"
                :class="
                  cn(
                    'hover:bg-accent-hover flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                    activePickerItemKey === getPickerItemKey(item)
                      && 'bg-accent text-accent-foreground',
                  )
                "
                @mousedown.prevent="
                  selectInternalLinksPickerItem(
                    internalLinksPickerState.items.findIndex(
                      (current) =>
                        current.id === item.id && current.type === item.type,
                    ),
                  )
                "
                @mousemove="setActivePickerItem(item)"
              >
                <span class="flex min-w-0 items-center gap-2">
                  <component
                    :is="getItemIcon(item.type)"
                    class="size-3.5 shrink-0"
                  />
                  <span class="truncate leading-5">{{ item.name }}</span>
                </span>
                <span class="text-muted-foreground shrink-0 truncate text-xs">
                  {{ item.locationLabel }}
                </span>
              </button>
            </div>
          </template>

          <div
            v-else
            class="text-muted-foreground px-2 py-3 text-sm"
          >
            {{ i18n.t("internalLinks.picker.emptyResults") }}
          </div>
        </div>
      </div>
    </Popover.PopoverContent>
  </Popover.Popover>

  <Popover.Popover
    :open="internalLinksPreviewState.isOpen"
    @update:open="onPreviewOpenUpdate"
  >
    <Popover.PopoverAnchor as-child>
      <div
        class="pointer-events-none fixed z-40 size-px"
        :style="previewAnchorStyle"
      />
    </Popover.PopoverAnchor>
    <Popover.PopoverContent
      v-if="internalLinksPreviewState.content"
      align="start"
      :side-offset="0"
      class="scrollbar max-h-[200px] w-[min(420px,calc(100vw-24px))] overflow-auto p-3"
      @mouseenter="onInternalLinksPreviewPopupEnter"
      @mouseleave="onInternalLinksPreviewPopupLeave"
      @open-auto-focus.prevent
    >
      <div class="text-[13px] leading-5 font-medium">
        {{ internalLinksPreviewState.content.title }}
      </div>
      <pre
        v-if="
          internalLinksPreviewState.content.body
            && internalLinksPreviewState.content.type === 'snippet'
        "
        class="mt-2 text-[12px] leading-[1.1rem] whitespace-pre-wrap"
      >{{ internalLinksPreviewState.content.body }}</pre>
      <div
        v-else-if="internalLinksPreviewState.content.body"
        class="mt-2 text-[12px] leading-[1.1rem] whitespace-pre-wrap"
      >
        {{ internalLinksPreviewState.content.body }}
      </div>
    </Popover.PopoverContent>
  </Popover.Popover>
</template>
