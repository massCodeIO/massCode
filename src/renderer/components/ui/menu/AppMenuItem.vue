<template>
  <div
    v-if="isShow"
    class="menu-item"
  >
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { menuKey } from './keys'

interface Props {
  name: string
  value: string
  group?: string
}

const props = defineProps<Props>()
const root = inject(menuKey)!

const init = () => {
  if (root.groups.value.length) {
    root.groups.value
      .find(g => g.name === props.group)
      ?.items.push({
        name: props.name,
        value: props.value
      })
  } else {
    const index = root.items.value.findIndex(i => i.value === props.value)

    if (index === -1) {
      root.items.value.push({
        name: props.name,
        value: props.value
      })
    }
  }
}

const isShow = computed(() => root.active.value === props.value)

init()
</script>

<style lang="scss" scoped></style>
