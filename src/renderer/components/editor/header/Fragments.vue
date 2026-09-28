<script setup lang="ts">
import * as Tabs from '@/components/ui/shadcn/tabs'
import { useApp, useSnippets } from '@/composables'
import { i18n } from '@/electron'
import { useEventListener } from '@vueuse/core'
import { Plus } from 'lucide-vue-next'
import Draggable from 'vuedraggable'

const { state } = useApp()
const {
  displayedSnippet,
  displayedSnippetContent,
  selectedSnippet,
  selectedSnippetRecordStatus,
  pendingContentReorders,
  reorderSnippetContents,
  addFragment,
} = useSnippets()

const viewport = ref<HTMLDivElement>()
const draggingId = ref<number>()
const insertion = ref<{ id: number, after: boolean }>()
let dragOrigin:
  | { pointerX: number, offsetX: number, width: number }
  | undefined

const canEdit = computed(
  () =>
    selectedSnippetRecordStatus.value === 'ready'
    && displayedSnippet.value?.id === state.snippetId
    && selectedSnippet.value?.id === state.snippetId
    && !displayedSnippet.value?.pendingCloudDownload
    && !pendingContentReorders.has(state.snippetId!),
)

function selectFragment(id: string | number) {
  if (!canEdit.value || draggingId.value !== undefined)
    return
  const index = displayedSnippet.value?.contents.findIndex(
    content => content.id === id,
  )
  if (index !== undefined && index >= 0)
    state.snippetContentIndex = index
}

function onAdd() {
  if (canEdit.value)
    void addFragment()
}

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0)
    return
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  dragOrigin = {
    pointerX: event.clientX,
    offsetX: event.clientX - rect.left,
    width: rect.width,
  }
}

function onDragStart(event: { item: HTMLElement }) {
  draggingId.value = Number(event.item.dataset.fragmentId)
}

function findInsertion(event: { clientX: number, clientY: number }) {
  const container = viewport.value
  if (!container)
    return
  const bounds = container.getBoundingClientRect()
  const hitSlop = 12
  if (
    event.clientX < bounds.left - hitSlop
    || event.clientX > bounds.right + hitSlop
    || event.clientY < bounds.top - hitSlop
    || event.clientY > bounds.bottom + hitSlop
  ) {
    return
  }

  const tabs = [
    ...container.querySelectorAll<HTMLElement>('[data-fragment-id]'),
  ]
  // Use the leading edge of the preview, preserving where the tab was grabbed.
  let targetX = event.clientX
  if (dragOrigin && event.clientX < dragOrigin.pointerX)
    targetX -= dragOrigin.offsetX
  else if (dragOrigin && event.clientX > dragOrigin.pointerX)
    targetX += dragOrigin.width - dragOrigin.offsetX
  const sourceIndex = tabs.findIndex(
    tab => Number(tab.dataset.fragmentId) === draggingId.value,
  )
  for (const [index, tab] of tabs.entries()) {
    const rect = tab.getBoundingClientRect()
    // Crossing the near edge is enough; don't require reaching the midpoint.
    const edgeInset = Math.min(24, rect.width * 0.2)
    let threshold = rect.left + rect.width / 2
    if (sourceIndex >= 0 && index > sourceIndex)
      threshold = rect.left + edgeInset
    else if (sourceIndex >= 0 && index < sourceIndex)
      threshold = rect.right - edgeInset
    if (targetX < threshold) {
      // Both boundaries around the source resolve to its current position.
      if (index === sourceIndex || index === sourceIndex + 1)
        return
      return { id: Number(tab.dataset.fragmentId), after: false }
    }
  }
  const last = tabs.at(-1)
  if (last && sourceIndex !== tabs.length - 1)
    return { id: Number(last.dataset.fragmentId), after: true }
}

function onPointerMove(event: PointerEvent) {
  if (draggingId.value !== undefined)
    insertion.value = findInsertion(event)
}

useEventListener('pointermove', onPointerMove)

// Keep the strip still during dragging; the marker alone previews insertion.
function preventLiveSort() {
  return false
}

function onDragEnd(event: { originalEvent?: MouseEvent }) {
  const sourceId = draggingId.value
  const target = event.originalEvent
    ? findInsertion(event.originalEvent)
    : undefined
  draggingId.value = undefined
  insertion.value = undefined
  dragOrigin = undefined
  if (
    !canEdit.value
    || sourceId === undefined
    || !target
    || !displayedSnippet.value
  ) {
    return
  }

  const ids = displayedSnippet.value.contents.map(content => content.id)
  const from = ids.indexOf(sourceId)
  const targetIndex = ids.indexOf(target.id)
  if (from < 0 || targetIndex < 0)
    return
  let to = targetIndex + Number(target.after)
  if (from < to)
    to--
  ids.splice(from, 1)
  ids.splice(to, 0, sourceId)
  void reorderSnippetContents(displayedSnippet.value.id, ids)
}
</script>

<template>
  <Tabs.Tabs
    v-if="displayedSnippet"
    :model-value="displayedSnippetContent?.id"
    activation-mode="manual"
    class="border-border max-w-full min-w-0 border-b px-2 py-1"
  >
    <div class="flex w-full min-w-0 items-center gap-1">
      <div
        ref="viewport"
        class="w-max min-w-0"
      >
        <Tabs.TabsList
          as-child
          class="w-full min-w-0 justify-start"
        >
          <Draggable
            :model-value="displayedSnippet.contents"
            item-key="id"
            direction="horizontal"
            :disabled="!canEdit || displayedSnippet.contents.length < 2"
            :move="preventLiveSort"
            :force-fallback="true"
            :fallback-on-body="true"
            :fallback-tolerance="4"
            ghost-class="fragment-placeholder"
            fallback-class="fragment-drag-preview"
            filter="input, textarea, [contenteditable]"
            :prevent-on-filter="false"
            @start="onDragStart"
            @end="onDragEnd"
          >
            <template #item="{ element: content, index }">
              <div
                :data-fragment-id="content.id"
                class="fragment-item relative h-full w-max max-w-50 min-w-0"
                :class="{
                  'insert-before':
                    insertion?.id === content.id && !insertion.after,
                  'insert-after':
                    insertion?.id === content.id && insertion.after,
                }"
                @pointerdown.capture="onPointerDown"
              >
                <!-- Include the preferred minimum in intrinsic sizing without preventing flex shrink. -->
                <span
                  aria-hidden="true"
                  class="pointer-events-none block h-0 w-[calc(1ch+1rem+2px)]"
                />
                <Tabs.TabsTrigger
                  :value="content.id"
                  as="div"
                  class="w-full min-w-0"
                  @click="selectFragment(content.id)"
                  @keydown.enter.space.prevent="selectFragment(content.id)"
                >
                  <EditorTab
                    :id="content.id"
                    :index="index"
                    :name="content.label"
                    class="flex h-full w-full items-center"
                  />
                </Tabs.TabsTrigger>
              </div>
            </template>
          </Draggable>
        </Tabs.TabsList>
      </div>
      <UiActionButton
        class="size-7 shrink-0"
        :disabled="!canEdit"
        :tooltip="i18n.t('action.new.fragment')"
        :aria-label="i18n.t('action.new.fragment')"
        shortcut="CommandOrControl+T"
        @click="onAdd"
      >
        <Plus class="size-4" />
      </UiActionButton>
    </div>
  </Tabs.Tabs>
</template>

<style scoped>
.fragment-placeholder > * {
  opacity: 0.35;
}

.fragment-item.insert-before::before,
.fragment-item.insert-after::after {
  position: absolute;
  z-index: 1;
  top: 2px;
  bottom: 2px;
  width: 2px;
  border-radius: 1px;
  background: var(--primary);
  content: "";
  pointer-events: none;
}

.fragment-item.insert-before::before {
  left: -1px;
}

.fragment-item.insert-after::after {
  right: -1px;
}

.fragment-drag-preview {
  border-radius: var(--radius-md);
  background: var(--accent);
  box-shadow: 0 3px 12px rgb(0 0 0 / 0.2);
  opacity: 1 !important;
}

.fragment-drag-preview > * {
  background: var(--accent);
  color: var(--foreground);
  opacity: 1;
}

:global(body:has(.fragment-drag-preview)),
:global(body:has(.fragment-drag-preview) *) {
  cursor: default !important;
}

/* Reka's context trigger has inline pointer-events:auto; clones must not hit-test. */
.fragment-drag-preview :deep(*) {
  pointer-events: none !important;
}

.fragment-drag-preview::before,
.fragment-drag-preview::after {
  display: none;
}
</style>
