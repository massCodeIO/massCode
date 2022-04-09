<template>
  <div class="form">
    <slot />
  </div>
</template>

<script setup lang="ts"></script>

<style lang="scss" scoped>
.form {
  width: 650px;
  display: flex;
  flex-flow: column;
  gap: var(--spacing-md);
}
</style>
