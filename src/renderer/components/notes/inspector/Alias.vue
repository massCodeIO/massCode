<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import { i18n } from '@/electron'
import { useResizeObserver } from '@vueuse/core'

const props = defineProps<{ alias: string }>()
const label = ref<HTMLElement>()
const expanded = ref(false)
const truncated = ref(false)

function measure() {
  if (label.value && !expanded.value)
    truncated.value = label.value.scrollHeight > label.value.clientHeight + 1
}
useResizeObserver(label, measure)
watch(
  () => props.alias,
  async () => {
    expanded.value = false
    await nextTick()
    measure()
  },
)
watch(expanded, async () => {
  await nextTick()
  measure()
})
</script>

<template>
  <span class="block">
    <span
      ref="label"
      class="break-words"
      :class="expanded ? 'block' : 'line-clamp-2'"
    >
      <UiText
        as="span"
        variant="xs"
        muted
      >{{
        i18n.t("notes.inspector.alias", { alias })
      }}</UiText>
    </span>
    <Button
      v-if="truncated || expanded"
      variant="link"
      class="h-auto p-0 text-xs"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    >
      {{
        i18n.t(
          expanded ? "notes.inspector.showLess" : "notes.inspector.showMore",
        )
      }}
    </Button>
  </span>
</template>
