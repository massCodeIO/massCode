<script setup lang="ts">
import { i18n } from '@/electron'
import { ChevronDown, ChevronUp, Search, X } from 'lucide-vue-next'

interface Props {
  count: number
  currentIndex: number
}

defineProps<Props>()

const emit = defineEmits<{
  close: []
  next: []
  previous: []
}>()

const query = defineModel<string>({ default: '' })
const shouldFocus = ref(true)

function focusInput() {
  shouldFocus.value = false
  nextTick(() => {
    shouldFocus.value = true
  })
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('close')
    return
  }

  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    emit(event.key === 'ArrowDown' ? 'next' : 'previous')
    return
  }

  if (event.key !== 'Enter')
    return

  event.preventDefault()
  if (event.shiftKey)
    emit('previous')
  else emit('next')
}

defineExpose({ focusInput })
</script>

<template>
  <div
    class="border-border bg-background flex shrink-0 items-center gap-1 border-b px-2 py-1"
    role="search"
    @keydown="onKeydown"
  >
    <Search class="text-muted-foreground size-3.5 shrink-0" />
    <div class="min-w-0 flex-1">
      <UiInput
        v-model="query"
        variant="ghost"
        class="h-7 min-w-0 px-1"
        :placeholder="i18n.t('contentSearch.placeholder')"
        :select="shouldFocus"
      />
    </div>
    <UiText
      as="div"
      variant="xs"
      muted
      class="min-w-12 shrink-0 text-center tabular-nums"
    >
      {{ count ? currentIndex + 1 : 0 }} / {{ count }}
    </UiText>
    <UiActionButton
      :disabled="!count"
      :tooltip="i18n.t('contentSearch.previous')"
      @click="emit('previous')"
    >
      <ChevronUp class="size-3.5" />
    </UiActionButton>
    <UiActionButton
      :disabled="!count"
      :tooltip="i18n.t('contentSearch.next')"
      @click="emit('next')"
    >
      <ChevronDown class="size-3.5" />
    </UiActionButton>
    <UiActionButton
      :tooltip="i18n.t('action.close')"
      @click="emit('close')"
    >
      <X class="size-3.5" />
    </UiActionButton>
  </div>
</template>
