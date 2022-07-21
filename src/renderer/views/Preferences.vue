<template>
  <div class="preferences">
    <div class="title">
      <h3>{{ i18n.t('preferences:title') }}</h3>
      <AppActionButton
        v-tooltip="i18n.t('close')"
        @click="toHome"
      >
        <UniconsTimes />
      </AppActionButton>
    </div>
    <div class="body">
      <AppMenu v-model="appStore.selectedPreferencesMenu">
        <AppMenuItem
          :name="i18n.t('preferences:storage.label')"
          value="storage"
        >
          <StoragePreferences />
        </AppMenuItem>
        <AppMenuItem
          :name="i18n.t('preferences:editor.label')"
          value="editor"
        >
          <EditorPreferences />
        </AppMenuItem>
        <AppMenuItem
          :name="i18n.t('preferences:appearance.label')"
          value="appearance"
        >
          <AppearancePreferences />
        </AppMenuItem>
        <AppMenuItem
          :name="i18n.t('preferences:language.label')"
          value="languages"
        >
          <LanguagePreferences />
        </AppMenuItem>
      </AppMenu>
    </div>
  </div>
</template>

<script setup lang="ts">
import { track, i18n } from '@/electron'
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
