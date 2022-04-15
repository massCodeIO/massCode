<template>
  <div class="preferences">
    <div class="title">
      <h3>Preferences</h3>
      <AppActionButton @click="toHome">
        <UniconsTimes />
      </AppActionButton>
    </div>
    <div class="body">
      <AppMenu v-model="appStore.selectedPreferencesMenu">
        <AppMenuItem
          name="Storage"
          value="storage"
        >
          <StoragePreferences />
        </AppMenuItem>
        <AppMenuItem
          name="Editor"
          value="editor"
        >
          <EditorPreferences />
        </AppMenuItem>
        <AppMenuItem
          name="Appearance"
          value="appearance"
        >
          <AppearancePreferences />
        </AppMenuItem>
      </AppMenu>
    </div>
  </div>
</template>

<script setup lang="ts">
import { track } from '@/electron'
import router from '@/router'
import { useAppStore } from '@/store/app'

const appStore = useAppStore()

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
}
.title {
  padding: var(--spacing-sm);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.body {
  padding: 0 0 var(--spacing-sm) var(--spacing-sm);
  display: grid;
}
</style>
