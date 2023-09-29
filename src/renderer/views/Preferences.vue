<template>
  <AppLayoutOneColumn
    :title="i18n.t('preferences:title')"
    @close="toHome"
  >
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
        :name="i18n.t('preferences:markdown.label')"
        value="markdown"
      >
        <MarkdownPreferences />
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
  </AppLayoutOneColumn>
</template>

<script setup lang="ts">
import { i18n } from '@/electron'
import { track } from '@/services/analytics'
import router from '@/router'
import { useAppStore } from '@/store/app'

const appStore = useAppStore()

const toHome = () => {
  router.push('/')
}

track('preferences')
</script>

<style lang="scss" scoped></style>
