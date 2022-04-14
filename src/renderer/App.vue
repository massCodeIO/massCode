<template>
  <div
    class="app-title-bar"
    :class="{ 'is-win': appStore.platform === 'win32' }"
  />
  <RouterView />
  <div
    v-if="isUpdateAvailable"
    class="update"
    @click="onClickUpdate"
  >
    <span> Update available </span>
  </div>
</template>

<script setup lang="ts">
import router from '@/router'
import { ref, watch } from 'vue'
import { ipc, store, track } from './electron'
import { useAppStore } from './store/app'
import { repository } from '../../package.json'
import { useSnippetStore } from './store/snippets'
import {
  onAddNewSnippet,
  onAddNewFragment,
  onAddNewFolder,
  onCopySnippet,
  emitter
} from '@/composable'

// По какой то причине необходимо явно установить роут в '/'
// для корректного поведения в продакшен сборке
// TODO: выяснить причину
router.push('/')

const appStore = useAppStore()
const snippetStore = useSnippetStore()

const isUpdateAvailable = ref(false)

const init = () => {
  const theme = store.preferences.get('theme')
  const isValid = appStore.isEditorSettingsValid(
    store.preferences.get('editor')
  )

  if (isValid) appStore.editor = store.preferences.get('editor')

  appStore.sizes.sidebar = store.app.get('sidebarWidth')
  appStore.sizes.snippetList = store.app.get('snippetListWidth')

  if (theme) {
    appStore.setTheme(theme)
  } else {
    appStore.setTheme('light:chrome')
  }

  trackAppUpdate()
}

const setTheme = (theme: string) => {
  document.body.dataset.theme = theme
}

const onClickUpdate = () => {
  ipc.invoke('main:open-url', `${repository}/releases`)
  track('app/update')
}

const trackAppUpdate = () => {
  const installedVersion = store.app.get('version')

  if (!installedVersion) track('app/install')

  if (installedVersion && appStore.version !== installedVersion) {
    track('app/update', appStore.version)
  }

  store.app.set('version', appStore.version)
}

init()

watch(
  () => appStore.theme,
  () => setTheme(appStore.theme),
  { immediate: true }
)

watch(
  () => snippetStore.selectedId,
  () => {
    snippetStore.isMarkdownPreview = false
  }
)

ipc.on('main-menu:preferences', () => {
  router.push('/preferences')
})

ipc.on('main:update-available', () => {
  isUpdateAvailable.value = true
})

ipc.on('main-menu:new-folder', async () => {
  await onAddNewFolder()
})

ipc.on('main-menu:new-snippet', async () => {
  await onAddNewSnippet()
})

ipc.on('main-menu:new-fragment', () => {
  onAddNewFragment()
})

ipc.on('main-menu:preview-markdown', async () => {
  if (snippetStore.currentLanguage === 'markdown') {
    snippetStore.isMarkdownPreview = !snippetStore.isMarkdownPreview
  }
})

ipc.on('main-menu:copy-snippet', () => {
  onCopySnippet()
})

ipc.on('main-menu:format-snippet', () => {
  emitter.emit('snippet:format', true)
})
</script>

<style lang="scss">
body {
  margin: 0;
}
#app {
  height: 100vh;
  overflow: hidden;
}
.app {
  &-title-bar {
    position: absolute;
    top: 0;
    width: 100%;
    height: var(--title-bar-height);
    user-select: none;
    -webkit-app-region: drag;
    z-index: 1010;
    transition: all 0.5s;
    &.is-win {
      border-top: 1px solid var(--color-border);
    }
  }
}
.update {
  position: absolute;
  top: 5px;
  right: var(--spacing-sm);
  z-index: 1020;
  text-transform: uppercase;
  font-size: 11px;
  font-weight: bold;
  background: -webkit-linear-gradient(60deg, var(--color-primary), limegreen);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-size: 200% auto;
  animation: shine 3s ease infinite;
}

@keyframes shine {
  from {
    background-position: 200%;
  }
}

@keyframes zoom {
  from {
    background-position: 100%;
  }
}
</style>
