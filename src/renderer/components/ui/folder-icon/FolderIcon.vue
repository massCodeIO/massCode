<script setup lang="ts">
import type { Variants } from './variants'
import { cn } from '@/utils'
import { Folder } from 'lucide-vue-next'
import { materialIconInnerSvgClass, resolveFolderIcon } from './icons'
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
  <div
    v-else-if="resolvedIcon?.svg"
    :class="cn(iconClass, materialIconInnerSvgClass)"
    :data-icon-name="resolvedIcon.name"
    v-html="resolvedIcon.svg"
  />
  <Folder
    v-else
    :class="iconClass"
    :data-icon-name="name"
  />
</template>
