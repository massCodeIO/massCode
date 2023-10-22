<template>
  <div class="screenshot-palette">
    <div
      v-for="(i, index) in palette"
      :key="index"
      class="item"
      :class="{ 'is-selected': index === selected }"
      :style="{ backgroundImage: `linear-gradient(45deg, ${i[0]}, ${i[1]})` }"
      @click="onSelect(i)"
    />
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from '@/store/app'
import { computed } from 'vue'

interface Props {
  modelValue: [string, string]
}

interface Emits {
  (e: 'update:modelValue', value: [string, string]): void
}

const emit = defineEmits<Emits>()

const props = defineProps<Props>()

const appStore = useAppStore()

const palette: [string, string][] = [
  ['#D02F98', '#9439CA'],
  ['#A58EFB', '#CEABF9'],
  ['#FFE623', '#FFE623'],
  ['#4169E1', '#4169E1'],
  ['#FC3CAD', '#FC3CAD'],
  ['#8E00A7', '#8E00A7']
]

const selected = computed(() =>
  palette.findIndex((i) => i.every((c, idx) => c === props.modelValue[idx]))
)

const onSelect = (value: [string, string]) => {
  emit('update:modelValue', value)
}

const itemBorderColor = computed(() =>
  appStore.isLightTheme ? '#fff' : 'var(--color-contrast-high'
)
</script>

<style lang="scss" scoped>
.screenshot-palette {
  display: flex;
  gap: var(--spacing-xs);
  .item {
    padding: 2px;
    border: 2px solid v-bind(itemBorderColor);
    width: 18px;
    height: 18px;
    border-radius: 4px;
    outline: 1px solid var(--color-border);
    &.is-selected {
      outline-color: var(--color-primary);
    }
  }
}
</style>
