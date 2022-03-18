<template>
  <div class="main">
    main
  </div>
</template>

<script setup lang="ts">

</script>

<style scoped lang="scss">

.main {
  display: grid;
  height: 100vh;
  background-color: var(--color-bg);
  overflow: hidden;
}
.update-available {
  position: absolute;
  top: 2px;
  right: var(--spacing-xs);
  font-size: var(--text-xs);
  text-transform: uppercase;
  font-weight: 500;
  color: var(--color-text);
  &:hover {
    text-decoration: underline;
  }
  z-index: 1020;
}
</style>
