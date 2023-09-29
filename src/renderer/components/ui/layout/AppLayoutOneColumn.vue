<template>
  <div class="layout-one-column">
    <div class="title">
      <h3>{{ title }}</h3>
      <AppActionButton
        v-tooltip="i18n.t('common:close')"
        @click="onClose"
      >
        <UniconsTimes />
      </AppActionButton>
    </div>
    <div class="body">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { i18n } from '@/electron'

interface Props {
  title: string
}

interface Emits {
  (e: 'close'): void
}

const emit = defineEmits<Emits>()

defineProps<Props>()

function onClose () {
  emit('close')
}
</script>

<style lang="scss" scoped>
.layout-one-column {
  h3 {
    margin: 0;
  }

  margin-top: var(--title-bar-height);

  .title {
    padding: var(--spacing-sm);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .body {
    padding: 0 var(--spacing-sm);
    display: grid;
  }
}
</style>
