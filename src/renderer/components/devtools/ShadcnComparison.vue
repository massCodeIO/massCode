<script setup lang="ts">
import { copy } from './shadcn-comparison/copy'
</script>

<template>
  <div class="space-y-8 py-5">
    <header class="space-y-2">
      <h1 class="text-2xl font-semibold tracking-tight">
        {{ copy.title }}
      </h1>
      <p class="text-muted-foreground max-w-3xl text-sm">
        {{ copy.description }}
      </p>
    </header>

    <DevtoolsShadcnComparisonRootUi />
    <DevtoolsShadcnComparisonLegacy />
    <DevtoolsShadcnComparisonShadcn2 />
  </div>
</template>
