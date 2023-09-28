<template>
  <div class="menu-group">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { inject } from 'vue'
import { menuKey } from './keys'

interface Props {
  label: string
  name: string
}

const props = defineProps<Props>()

const root = inject(menuKey)!

root.groups.value.push({
  name: props.name,
  label: props.label,
  items: []
})
</script>

<style lang="scss" scoped></style>
