<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  href: string
}

const props = defineProps<Props>()

const isExternal = computed(() => props.href && /^[a-z]+:/.test(props.href))

const component = computed(() => {
  if (props.tag)
    return props.tag

  return props.href ? 'a' : 'button'
})
</script>

<template>
  <span class="app-link">
    <component
      :is="component"
      class="app-link"
      :href="href"
      :target="isExternal ? '_blank' : null"
      :rel="isExternal ? 'noopener noreferrer' : null"
    >
      <slot />
      <template v-if="isExternal">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          focusable="false"
          viewBox="0 0 24 24"
          class="icon"
          data-v-e3f91ec3=""
        >
          <path
            d="M0 0h24v24H0V0z"
            fill="none"
          />
          <path d="M9 5v2h6.59L4 18.59 5.41 20 17 8.41V15h2V5H9z" />
        </svg>
      </template>
    </component>
  </span>
</template>

<style>
.app-link {
  display: inline-flex;

  a {
    color: var(--vp-c-brand);
    text-decoration: none;

    &:hover {
      color: var(--vp-button-brand-hover-bg);
    }
  }

  .icon {
    width: 12px;
    fill: var(--vp-c-gray-light-2);
  }
}

.vp-doc.custom-block a {
  color: inherit;
}
</style>
