<script setup lang="ts">
const demoContent = [
  '# Hello',
  '',
  'This is a **markdown** editor demo.',
  '',
  '- Item 1',
  '- Item 2',
  '- Item 3',
  '',
  '> Blockquote example',
  '',
  '`inline code` and more text.',
  '',
  '```ts',
  'function greet(name: string) {',
  '  console.log("Hello, " + name)',
  '}',
  '```',
].join('\n')

const content = ref(demoContent)
</script>

<template>
  <div class="flex h-full flex-col pt-[var(--content-top-offset)]">
    <NotesEditor v-model:content="content" />
  </div>
</template>
