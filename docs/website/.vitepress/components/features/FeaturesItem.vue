<script setup lang="ts">
interface Props {
  title: string
}

defineProps<Props>()
</script>

<template>
  <div class="features-item">
    <div class="title">
      {{ title }}
    </div>
    <div class="body">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.features-item {
  background-color: var(--vp-c-bg-soft);
  border-radius: 12px;
  padding: 24px;

  .title {
    line-height: 24px;
    font-size: 16px;
    font-weight: 600;
  }

  .body {
    padding-top: 8px;
    line-height: 24px;
    font-size: 14px;
    font-weight: 500;
    color: var(--vp-c-text-2);
  }
}
</style>
