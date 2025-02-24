<script setup lang="ts">
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
</script>

<template>
  <div
    data-gutter
    class="absolute top-0 right-0 w-[2px] h-full cursor-col-resize after:block after:h-full after:w-[8px] after:absolute after:-left-[3px] after:z-10"
    :class="{ 'bg-blue-500': isHovered || isDragging }"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
    @mousedown="onMouseDown"
  />
</template>
