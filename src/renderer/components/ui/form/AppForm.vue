<template>
  <div class="form">
    <slot />
  </div>
</template>

<script setup lang="ts"></script>

<style lang="scss" scoped>
.form {
  max-width: 800px;
  display: flex;
  flex-flow: column;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-md);
}
</style>
