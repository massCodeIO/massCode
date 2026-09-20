<script setup lang="ts">
import { ipc } from '@/electron'
import { refThrottled } from '@vueuse/core'
import { renderMarkdownBlocks } from './markdown'

const props = defineProps<{ content: string }>()
const content = computed(() => props.content)
const throttled = refThrottled(content, 150)
const rendered = computed(() => renderMarkdownBlocks(throttled.value))
const container = ref<HTMLElement>()
const targets = shallowRef<HTMLElement[]>([])
watch(
  rendered,
  async () => {
    targets.value = []
    await nextTick()
    targets.value = Array.from(
      container.value?.querySelectorAll<HTMLElement>('[data-ai-code]') ?? [],
    )
  },
  { immediate: true },
)

function openLink(event: MouseEvent) {
  const target = event.target as HTMLElement
  const link = target.closest('a')
  if (!link)
    return
  event.preventDefault()
  const href = link.getAttribute('href')
  if (href && /^https?:\/\//i.test(href))
    void ipc.invoke('system:open-external', href)
}
</script>

<template>
  <UiText
    as="div"
    variant="sm"
    class="ai-markdown min-w-0 break-words select-text"
  >
    <div
      ref="container"
      @click="openLink"
      v-html="rendered.html"
    />
    <Teleport
      v-for="(target, index) in targets"
      :key="index"
      :to="target"
    >
      <AiCodeBlock
        :code="rendered.blocks[index]!.code"
        :language="rendered.blocks[index]!.language"
      />
    </Teleport>
  </UiText>
</template>

<style scoped>
.ai-markdown :deep(> div > * + *) {
  margin-top: 0.75rem;
}
.ai-markdown :deep(h1),
.ai-markdown :deep(h2),
.ai-markdown :deep(h3),
.ai-markdown :deep(h4),
.ai-markdown :deep(h5),
.ai-markdown :deep(h6) {
  font-weight: 600;
  line-height: 1.4;
}
.ai-markdown :deep(h1) {
  font-size: 1.25em;
}
.ai-markdown :deep(h2) {
  font-size: 1.125em;
}
.ai-markdown :deep(ul) {
  list-style: disc;
  padding-left: 1.5rem;
}
.ai-markdown :deep(ol) {
  list-style: decimal;
  padding-left: 1.5rem;
}
.ai-markdown :deep(li + li),
.ai-markdown :deep(li > p + p) {
  margin-top: 0.25rem;
}
.ai-markdown :deep(pre) {
  overflow-x: auto;
  white-space: pre;
  padding: 0.75rem;
  border-radius: var(--radius);
  background: var(--muted);
}
.ai-markdown :deep(code) {
  font-family: var(--font-mono);
  font-size: 0.9em;
}
.ai-markdown :deep(:not(pre) > code) {
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  background: var(--muted);
}
.ai-markdown :deep(blockquote) {
  border-left: 2px solid var(--border);
  padding-left: 0.75rem;
  color: var(--muted-foreground);
}
.ai-markdown :deep(table) {
  display: block;
  overflow-x: auto;
  border-collapse: collapse;
}
.ai-markdown :deep(th),
.ai-markdown :deep(td) {
  border: 1px solid var(--border);
  padding: 0.375rem 0.5rem;
}
.ai-markdown :deep(a) {
  color: var(--primary);
  text-decoration: underline;
}
.ai-markdown :deep(hr) {
  border-color: var(--border);
}
</style>
