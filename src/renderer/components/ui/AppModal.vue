<template>
  <div
    v-if="show"
    class="app-modal"
    @click.self="emit('update:show', false)"
  >
    <div class="body">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  show: boolean
}

interface Emits {
  (e: 'update:show', value: boolean): void
}

const emit = defineEmits<Emits>()

defineProps<Props>()
</script>

<style lang="scss" scoped>
.app-modal {
  position: absolute;
  z-index: 1010;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  padding: var(--spacing-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background-color: rgba(0, 0, 0, 0.4);
  .body {
    width: 450px;
    height: 350px;
    overflow: hidden;
    border-radius: 6px;
    background-color: var(--color-bg);
  }
}
</style>
