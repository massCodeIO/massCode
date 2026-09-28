<script setup lang="ts">
import { i18n } from '@/electron'
import { ExternalLink, LocateFixed } from 'lucide-vue-next'

const props = defineProps<{
  translationKey: string
  action: 'locate' | 'external'
  shortcut?: string
}>()
const parts = computed(() =>
  i18n
    .t(props.translationKey, { action: '\uFFFC', shortcut: '\uFFFD' })
    .split(/([\uFFFC\uFFFD])/),
)
const actionLabel = computed(() =>
  i18n.t(
    props.action === 'locate'
      ? 'notes.inspector.reveal'
      : 'notes.inspector.openExternal',
  ),
)
</script>

<template>
  <UiText
    as="p"
    variant="xs"
    muted
  >
    <template
      v-for="(part, index) in parts"
      :key="index"
    >
      <span
        v-if="part === '\uFFFC'"
        class="text-muted-foreground inline-flex h-4 w-5 items-center justify-center align-[-0.2em]"
        role="img"
        :aria-label="actionLabel"
      ><LocateFixed
        v-if="action === 'locate'"
        class="size-3.5"
        aria-hidden="true"
      /><ExternalLink
        v-else
        class="size-3.5"
        aria-hidden="true"
      /></span><UiKbd v-else-if="part === '\uFFFD'">
        {{ shortcut }}
      </UiKbd><template v-else>
        {{ part }}
      </template>
    </template>
  </UiText>
</template>
