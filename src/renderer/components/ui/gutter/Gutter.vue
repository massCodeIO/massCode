<script setup lang="ts">
interface Props {
  orientation?: 'horizontal' | 'vertical'
}

const props = withDefaults(defineProps<Props>(), {
  orientation: 'vertical',
})

const isHovered = ref(false)
const isDragging = ref(false)
let hoverTimer: number | null = null

function onMouseEnter() {
  hoverTimer = window.setTimeout(() => {
    isHovered.value = true
  }, 500)
}

function onMouseLeave() {
  if (hoverTimer) {
    clearTimeout(hoverTimer)
    hoverTimer = null
  }
  if (!isDragging.value) {
    isHovered.value = false
  }
}

function onMouseDown() {
  isDragging.value = true
  isHovered.value = true
  document.addEventListener('mouseup', onMouseUp)
  document.addEventListener('mousemove', onMouseMove)
}

function onMouseUp() {
  isDragging.value = false
  isHovered.value = false
  document.removeEventListener('mouseup', onMouseUp)
  document.removeEventListener('mousemove', onMouseMove)
}

function onMouseMove() {
  isHovered.value = true
}

// Вычисляемое свойство для определения стилей в зависимости от ориентации
const gutterClasses = computed(() => {
  const baseClasses = { 'bg-primary': isHovered.value || isDragging.value }

  if (props.orientation === 'vertical') {
    return {
      ...baseClasses,
      'absolute top-0 right-0 w-[1px] h-full cursor-col-resize': true,
      'w-[2px]': isHovered.value || isDragging.value,
    }
  }
  else {
    // horizontal
    return {
      ...baseClasses,
      'absolute bottom-0 left-0 h-[1px] w-full cursor-row-resize': true,
      'h-[2px]': isHovered.value || isDragging.value,
    }
  }
})

// Вычисляемое свойство для определения стилей after-псевдоэлемента
const afterStyles = computed(() => {
  if (props.orientation === 'vertical') {
    return 'after:block after:h-full after:w-[8px] after:absolute after:-left-[3px] after:z-10'
  }
  else {
    // horizontal
    return 'after:block after:w-full after:h-[8px] after:absolute after:-top-[3px] after:z-10'
  }
})
</script>

<template>
  <div
    data-gutter
    class="bg-border"
    :class="[gutterClasses, afterStyles]"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
    @mousedown="onMouseDown"
  />
</template>
