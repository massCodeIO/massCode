<script setup lang="ts">
interface Props {
  title: string
  sectionTitle?: string
}

defineProps<Props>()
</script>

<template>
  <div>
    <div class="flex h-7 items-center justify-between pl-1 select-none">
      <div class="truncate leading-5 font-bold">
        {{ title }}
      </div>
      <div
        v-if="$slots.actions"
        class="flex items-center gap-1"
      >
        <slot name="actions" />
      </div>
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
