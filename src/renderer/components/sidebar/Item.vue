<script setup lang="ts">
interface Props {
  selected?: boolean
  focused?: boolean
  hoverable?: boolean
}

withDefaults(defineProps<Props>(), {
  selected: false,
  focused: false,
  hoverable: true,
})
</script>

<template>
  <div
    data-sidebar-item
    :data-selected="selected ? 'true' : undefined"
    :data-focused="focused ? 'true' : undefined"
    class="data-[selected=true]:bg-accent data-[focused=true]:bg-primary! data-[focused=true]:text-primary-foreground rounded-md"
    :class="{
      'hover:bg-accent-hover': hoverable && !selected && !focused,
    }"
  >
    <slot />
  </div>
</template>
