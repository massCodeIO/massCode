<template>
  <div class="menu-group">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { menuKey } from './keys'

interface Props {
  label: string
  name: string
}

const props = defineProps<Props>()

const root = inject(menuKey)!

root.groups.value.push({
  name: props.name,
  items: []
})
</script>

<style lang="scss" scoped></style>
