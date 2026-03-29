<script setup lang="ts">
import TheFeatures from './features/TheFeatures.vue'
import SponsorsGroup from './sponsors/SponsorsGroup.vue'
</script>

<template>
  <div class="home">
    <section id="features">
      <TheFeatures />
    </section>
    <section id="sponsors">
      <SponsorsGroup
        title="Special"
        tier="special"
      />
    </section>
  </div>
</template>

<style scoped>
section {
  max-width: 1152px;
  margin: 0 auto;

  + section {
    margin-top: 24px;
  }
}
</style>
