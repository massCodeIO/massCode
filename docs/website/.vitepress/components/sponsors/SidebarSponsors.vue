<script setup lang="ts">
import SponsorsGroup from './SponsorsGroup.vue'
</script>

<template>
  <div class="sidebar-sponsors">
    <SponsorsGroup
      tier="special"
      placement="sidebar"
    />
  </div>
</template>

<style scoped>
.sidebar-sponsors:not(:first-child) {
  margin-top: 32px;
}
</style>
