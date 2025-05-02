<script setup lang="ts">
import { Check } from 'lucide-vue-next'

type Active = 'disco' | 'salad' | 'cucumber' | 'aqua' | 'lovely'

const active = defineModel<Active>('active', {
  required: true,
})

const gradients: { name: Active, class: string }[] = [
  {
    name: 'disco',
    class: 'gradient-disco',
  },
  {
    name: 'aqua',
    class: 'gradient-aqua',
  },
  {
    name: 'salad',
    class: 'gradient-salad',
  },
  {
    name: 'cucumber',
    class: 'gradient-cucumber',
  },
  {
    name: 'lovely',
    class: 'gradient-lovely',
  },
]
</script>

<template>
  <div class="flex items-center gap-2">
    <div
      v-for="gradient in gradients"
      :key="gradient.name"
      class="flex h-4 w-4 items-center justify-center rounded-sm"
      :class="gradient.class"
      @click="active = gradient.name"
    >
      <Check
        v-if="active === gradient.name"
        class="h-3 w-3 text-black"
      />
    </div>
  </div>
</template>
