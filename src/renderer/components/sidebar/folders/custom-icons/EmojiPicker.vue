<script setup lang="ts">
import type { EmojiCategory } from './emojis'
import { Button } from '@/components/ui/shadcn/button'
import { i18n } from '@/electron'
import { RecycleScroller } from 'vue-virtual-scroller'
import { getEmojiRows, getFilteredEmojis } from './emojis'

const emit = defineEmits<{
  select: [emoji: string]
}>()

const search = ref('')
const selectedIndex = ref(-1)
const listRef = useTemplateRef<{
  scrollToItem: (index: number) => void
}>('listRef')

const visibleEmojis = computed(() => getFilteredEmojis(search.value))
const rows = computed(() => getEmojiRows(search.value))
const rowIndexByEmoji = computed(() => {
  const result = new Map<string, number>()

  rows.value.forEach((row, rowIndex) => {
    row.items?.forEach(item => result.set(item.emoji, rowIndex))
  })

  return result
})

function getCategoryTitle(category: EmojiCategory) {
  return i18n.t(`folder.iconPicker.emojiCategories.${category}`)
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

  const length = visibleEmojis.value.length
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
    const item = visibleEmojis.value[selectedIndex.value]
    if (item)
      emit('select', item.emoji)
  }
}

watch(search, () => {
  selectedIndex.value = -1
  nextTick(() => listRef.value?.scrollToItem(0))
})

watch(selectedIndex, () => {
  if (selectedIndex.value < 0)
    return

  const emoji = visibleEmojis.value[selectedIndex.value]?.emoji
  const rowIndex = emoji ? rowIndexByEmoji.value.get(emoji) : undefined

  if (rowIndex !== undefined)
    listRef.value?.scrollToItem(rowIndex)
})
</script>

<template>
  <div class="space-y-3">
    <UiInput
      v-model="search"
      autofocus
      focus
      :placeholder="i18n.t('folder.iconPicker.emojiSearchPlaceholder')"
      @keydown="onKeydown"
    />
    <RecycleScroller
      v-if="rows.length"
      ref="listRef"
      class="scrollbar h-[280px]"
      :item-size="44"
      :items="rows"
      key-field="id"
    >
      <template #default="slotProps">
        <template v-if="slotProps?.item">
          <UiText
            v-if="slotProps.item.type === 'category'"
            as="div"
            variant="xs"
            weight="medium"
            muted
            class="flex h-11 items-end px-1 pb-2"
          >
            {{ getCategoryTitle(slotProps.item.category) }}
          </UiText>
          <div
            v-else
            class="grid h-11 grid-cols-8 gap-2"
          >
            <Button
              v-for="item in slotProps.item.items"
              :key="item.emoji"
              :aria-label="item.emoji"
              class="size-9 px-0 text-xl"
              :class="
                visibleEmojis[selectedIndex]?.emoji === item.emoji
                  ? 'bg-muted'
                  : ''
              "
              size="icon"
              type="button"
              variant="ghost"
              @click="emit('select', item.emoji)"
            >
              <span
                aria-hidden="true"
                class="leading-none"
                style="
                  font-family:
                    &quot;Apple Color Emoji&quot;, &quot;Segoe UI Emoji&quot;,
                    &quot;Noto Color Emoji&quot;, sans-serif;
                "
              >{{ item.emoji }}</span>
            </Button>
          </div>
        </template>
      </template>
    </RecycleScroller>
    <div
      v-else
      class="flex min-h-24 items-center justify-center px-4 text-center"
    >
      <UiText
        variant="sm"
        muted
      >
        {{ i18n.t("folder.iconPicker.emptyEmojiResults") }}
      </UiText>
    </div>
  </div>
</template>
