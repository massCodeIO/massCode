<script setup lang="ts">
interface Props {
  title: string
  sectionTitle?: string
}

defineProps<Props>()
</script>

<template>
  <div class="px-1">
    <div class="truncate px-1 leading-5 font-bold select-none">
      {{ title }}
    </div>
    <SidebarSectionHeader
      v-if="sectionTitle"
      :title="sectionTitle"
    >
      <template
        v-if="$slots.action"
        #action
      >
        <slot name="action" />
      </template>
    </SidebarSectionHeader>
  </div>
</template>
