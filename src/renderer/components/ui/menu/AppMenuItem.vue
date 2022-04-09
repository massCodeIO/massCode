<template>
  <div
    v-if="isShow"
    class="menu-item"
  >
    <slot />
  </div>
</template>

<script setup lang="ts">
import type { Ref } from 'vue'
import { computed, inject } from 'vue'

interface Props {
  name: string
  value: string
}

const props = defineProps<Props>()

const rootValue = inject('value') as Ref
const items = inject('items') as Props[]

const init = () => {
  const index = items.findIndex(i => i.value === props.value)
  if (index === -1) {
    items.push({
      name: props.name,
      value: props.value
    })
  }
}

const isShow = computed(() => rootValue.value === props.value)

init()
</script>

<style lang="scss" scoped></style>
