<script setup lang="ts">
import type { Variants } from './variants'
import { cn } from '@/utils'
import { Folder } from 'lucide-vue-next'
import { resolveFolderIcon } from './icons'
import { variants } from './variants'

interface Props {
  name: string
  size?: Variants['size']
  class?: string
}

const props = defineProps<Props>()

const resolvedIcon = computed(() => resolveFolderIcon(props.name))
const iconClass = computed(() =>
  cn(variants({ size: props.size }), props.class),
)
</script>

<template>
  <component
    :is="resolvedIcon.component"
    v-if="resolvedIcon?.component"
    :class="iconClass"
    :data-icon-name="resolvedIcon.name"
  />
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
