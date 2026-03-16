<script setup lang="ts">
const demoContent = [
  '# Heading 1',
  '',
  '## Heading 2',
  '',
  '### Heading 3',
  '',
  'Regular text with **bold**, *italic*, and ~~strikethrough~~ formatting.',
  '',
  'A [link example](https://masscode.io) and `inline code` in a sentence.',
  '',
  '---',
  '',
  '> Blockquotes can contain **formatted** text and `code`.',
  '',
  '- Unordered item 1',
  '- Unordered item 2',
  '  - Nested item',
  '- Unordered item 3',
  '',
  '1. Ordered item 1',
  '2. Ordered item 2',
  '3. Ordered item 3',
  '',
  '- [x] Completed task',
  '- [ ] Pending task',
  '- [ ] Another task',
  '',
  '```ts',
  'interface User {',
  '  name: string',
  '  age: number',
  '}',
  '',
  'function greet(user: User): string {',
  '  return "Hello, " + user.name',
  '}',
  '```',
  '',
  '```css',
  '.container {',
  '  display: flex;',
  '  gap: 16px;',
  '  padding: 24px;',
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
