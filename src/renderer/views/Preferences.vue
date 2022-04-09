<template>
  <div class="preferences">
    <div class="title">
      <h3>Preferences</h3>
      <AppActionButton @click="toHome">
        <UniconsTimes />
      </AppActionButton>
    </div>
    <div class="body">
      <AppMenu v-model="activeMenu">
        <AppMenuItem
          name="Storage"
          value="storage"
        >
          <Storage />
        </AppMenuItem>
      </AppMenu>
    </div>
  </div>
</template>

<script setup lang="ts">
import { track } from '@/electron'
import router from '@/router'
import { ref } from 'vue'

const activeMenu = ref('storage')

const toHome = () => {
  router.push('/')
}

track('preferences')
</script>

<style lang="scss" scoped>
.preferences {
  h3 {
    margin: 0;
  }
  margin-top: var(--title-bar-height);
  padding: var(--spacing-sm);
}
.title {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.body {
  padding-top: var(--spacing-sm);
  display: grid;
  grid-template-columns: 200px 1fr;
}
</style>
