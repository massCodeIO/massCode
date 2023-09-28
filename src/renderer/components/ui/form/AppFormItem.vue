<template>
  <div class="form-item">
    <div class="label">
      {{ label }}
    </div>
    <div class="inner">
      <div class="body">
        <slot />
      </div>
      <div
        v-if="$slots.actions"
        class="actions"
      >
        <slot name="actions" />
      </div>
      <div
        v-if="$slots.desc"
        class="desc"
      >
        <slot name="desc" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  label: string
}

defineProps<Props>()
</script>

<style lang="scss" scoped>
.form-item {
  display: grid;
  grid-template-columns: 150px 1fr;
  gap: var(--spacing-sm);
  .inner {
    display: flex;
    flex-flow: column;
  }
  .body {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }
  .actions {
    margin-top: var(--spacing-sm);
    display: flex;
    flex-flow: wrap;
    gap: var(--spacing-sm);
  }
}
</style>
