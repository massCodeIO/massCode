<script setup lang="ts">
import type { Variants } from './variants'
import type { FolderIconSpaceId } from '~/main/types/ipc'
import { cn } from '@/utils'
import { Folder } from 'lucide-vue-next'
import { parseFolderIconValue, resolveFolderIcon } from './icons'
import { variants } from './variants'

interface Props {
  name: string
  size?: Variants['size']
  class?: string
  folderId?: number
  spaceId?: FolderIconSpaceId
}

const props = defineProps<Props>()

const resolvedIcon = computed(() => resolveFolderIcon(props.name))
const emoji = computed(() => {
  const parsed = parseFolderIconValue(props.name)
  return parsed?.source === 'emoji' ? parsed.name : null
})
const customIconBaseUrl = computed(() => {
  const parsed = parseFolderIconValue(props.name)
  if (parsed?.source !== 'custom' || !props.spaceId || !props.folderId) {
    return null
  }

  return `masscode://folder-icon/${props.spaceId}/${props.folderId}?v=${encodeURIComponent(parsed.name)}`
})
const customIconRetry = ref(0)
const customIconFailed = ref(false)
const customIconUrl = computed(() => {
  if (!customIconBaseUrl.value || customIconFailed.value)
    return null

  return `${customIconBaseUrl.value}&retry=${customIconRetry.value}`
})
const iconClass = computed(() =>
  cn(variants({ size: props.size }), props.class),
)

let retryTimer: ReturnType<typeof setTimeout> | undefined

function clearRetryTimer() {
  if (retryTimer)
    clearTimeout(retryTimer)
  retryTimer = undefined
}

function onCustomIconError() {
  if (retryTimer)
    return

  if (customIconRetry.value >= 12) {
    customIconFailed.value = true
    return
  }

  retryTimer = setTimeout(() => {
    retryTimer = undefined
    customIconRetry.value += 1
  }, 5_000)
}

watch(customIconBaseUrl, () => {
  clearRetryTimer()
  customIconFailed.value = false
  customIconRetry.value = 0
})

onBeforeUnmount(clearRetryTimer)
</script>

<template>
  <span
    v-if="emoji"
    aria-hidden="true"
    :class="
      cn(
        iconClass,
        'inline-flex items-center justify-center leading-none',
        size === 'md' ? 'text-2xl' : 'text-sm',
      )
    "
    :data-icon-name="name"
    style="
      font-family:
        &quot;Apple Color Emoji&quot;, &quot;Segoe UI Emoji&quot;,
        &quot;Noto Color Emoji&quot;, sans-serif;
    "
  >{{ emoji }}</span>
  <component
    :is="resolvedIcon.component"
    v-else-if="resolvedIcon?.component"
    :class="iconClass"
    :data-icon-name="resolvedIcon.name"
  />
  <img
    v-else-if="customIconUrl"
    alt=""
    :class="cn(iconClass, 'rounded-sm object-cover')"
    :data-icon-name="name"
    :src="customIconUrl"
    @error="onCustomIconError"
  >
  <img
    v-else-if="resolvedIcon?.src"
    :alt="resolvedIcon.name"
    :class="cn(iconClass, 'object-contain')"
    :data-icon-name="resolvedIcon.name"
    :src="resolvedIcon.src"
  >
  <Folder
    v-else
    :class="iconClass"
    :data-icon-name="name"
  />
</template>
