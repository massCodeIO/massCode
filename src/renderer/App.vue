<template>
  <div
    class="app-title-bar"
    :class="{ 'is-win': appStore.platform === 'win32' }"
  />
  <RouterView />
  <div class="top-notification">
    <span
      v-if="!appStore.isSponsored && !isUpdateAvailable"
      class="unsponsored"
    >
      <span v-if="!isDev">
        {{ i18n.t('special:unsponsored') }}
      </span>
    </span>
    <span
      v-if="isUpdateAvailable"
      class="update"
      @click="onClickUpdate"
    >
      {{ i18n.t('updateAvailable') }}
    </span>
  </div>
  <!-- TODO: Подумать о дальнейшем управлении глобальным модальным окном -->
  <AppModal v-model:show="appStore.showModal">
    <AppFolderIcons />
  </AppModal>
</template>

<script setup lang="ts">
import router from '@/router'
import { nextTick, ref, watch } from 'vue'
import { ipc, store, i18n } from './electron'
import { track } from '@/services/analytics'
import { EDITOR_DEFAULTS, useAppStore } from './store/app'
import { useSnippetStore } from './store/snippets'
import {
  onAddNewSnippet,
  onAddNewFragment,
  onAddNewFolder,
  onCopySnippet,
  emitter,
  onCreateSnippet,
  onAddDescription,
  goToSnippet
} from '@/composable'
import { useRoute } from 'vue-router'
import type { Snippet } from '@shared/types/main/db'
import { loadWASM } from 'onigasm'
import onigasmFile from 'onigasm/lib/onigasm.wasm?url'
import { loadGrammars } from '@/components/editor/grammars'
import {
  useSupportNotification,
  checkForRemoteNotification
} from '@/composable/notification'

// По какой то причине необходимо явно установить роут в '/'
// для корректного поведения в продакшен сборке
// TODO: выяснить причину
router.push('/')

const appStore = useAppStore()
const snippetStore = useSnippetStore()
const route = useRoute()

const { showSupportToast } = useSupportNotification()

const isUpdateAvailable = ref(false)
const isDev = import.meta.env.DEV

const init = async () => {
  loadWASM(onigasmFile)
  await loadGrammars()

  const theme = store.preferences.get('theme')
  const dateInstallation = store.app.get('dateInstallation')
  const isValid = appStore.isEditorSettingsValid(
    store.preferences.get('editor')
  )

  if (isValid) appStore.editor = store.preferences.get('editor')

  appStore.sizes.sidebar = store.app.get('sidebarWidth')
  appStore.sizes.snippetList = store.app.get('snippetListWidth')
  appStore.screenshot = store.preferences.get('screenshot')
  appStore.markdown = {
    ...appStore.markdown,
    ...store.preferences.get('markdown')
  }

  snippetStore.sort = store.app.get('sort')
  snippetStore.hideSubfolderSnippets = store.app.get('hideSubfolderSnippets')
  snippetStore.compactMode = store.app.get('compactMode')

  if (theme) {
    appStore.setTheme(theme)
  } else {
    appStore.setTheme('light:github')
  }

  if (!dateInstallation) {
    store.app.set('dateInstallation', new Date().valueOf())
  }

  trackAppUpdate()
  checkForRemoteNotification()
}

const setTheme = (theme: string) => {
  document.body.dataset.theme = theme
}

const onClickUpdate = () => {
  ipc.invoke(
    'main:open-url',
    'https://masscode.io/download/latest-release.html'
  )
  track('app/update')
}

const trackAppUpdate = () => {
  const installedVersion = store.app.get('version')

  if (!installedVersion) track('app/install')

  if (installedVersion && appStore.version !== installedVersion) {
    track('app/update', `from-${installedVersion}`)
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
  () => [snippetStore.selectedId, snippetStore.fragment],
  () => {
    const lang = snippetStore.selected?.content[snippetStore.fragment]?.language

    if (lang && lang !== 'markdown') {
      snippetStore.isMarkdownPreview = false
      snippetStore.isMindmapPreview = false
    }
  }
)

watch(
  () => route.path,
  () => {
    if (route.path === '/') {
      nextTick(() => {
        emitter.emit('scroll-to:snippet', snippetStore.selectedId!)
      })
    }
  }
)

watch(
  () => appStore.editor,
  v => {
    store.preferences.set('editor', { ...v })
  },
  { deep: true }
)

ipc.on('main:update-available', () => {
  isUpdateAvailable.value = true
})

ipc.on('main:focus', () => {
  // Yes, this is that annoying piece of crap code.
  // You can delete it, but know that you hurt me.
  showSupportToast()
})

ipc.on('main:app-protocol', (event, payload: string) => {
  if (/^masscode:\/\/snippets/.test(payload)) {
    const snippetId = payload.split('/').pop()
    if (snippetId) goToSnippet(snippetId, true)
  }
})

ipc.on('main-menu:preferences', () => {
  router.push('/preferences')
})

ipc.on('main-menu:devtools', () => {
  router.push('/devtools')
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
    snippetStore.togglePreview('markdown')
    track('snippets/markdown-preview')
  }
})
ipc.on('main-menu:presentation-mode', async () => {
  if (snippetStore.currentLanguage === 'markdown') {
    router.push('/presentation')
  }
})

ipc.on('main-menu:preview-code', () => {
  snippetStore.togglePreview('code')
})
ipc.on('main-menu:preview-mindmap', () => {
  snippetStore.togglePreview('mindmap')
})

ipc.on('main-menu:copy-snippet', () => {
  onCopySnippet()
})

ipc.on('main-menu:format-snippet', () => {
  emitter.emit('snippet:format', true)
})

ipc.on('main-menu:search', () => {
  emitter.emit('search:focus', true)
})

ipc.on('main-menu:sort-snippets', (event, sort) => {
  snippetStore.setSort(sort)
})

ipc.on('main-menu:hide-subfolder-snippets', () => {
  snippetStore.hideSubfolderSnippets = !snippetStore.hideSubfolderSnippets
  store.app.set('hideSubfolderSnippets', snippetStore.hideSubfolderSnippets)
})

ipc.on('main-menu:compact-mode-snippets', () => {
  snippetStore.compactMode = !snippetStore.compactMode
  store.app.set('compactMode', snippetStore.compactMode)
})

ipc.on('main-menu:add-description', async () => {
  await onAddDescription()
})

ipc.on('main-menu:font-size-increase', async () => {
  appStore.editor.fontSize += 1
  emitter.emit('editor:refresh', true)
})

ipc.on('main-menu:font-size-decrease', async () => {
  if (appStore.editor.fontSize === 1) return
  appStore.editor.fontSize -= 1
  emitter.emit('editor:refresh', true)
})

ipc.on('main-menu:font-size-reset', async () => {
  appStore.editor.fontSize = EDITOR_DEFAULTS.fontSize
  emitter.emit('editor:refresh', true)
})

ipc.on('main-menu:history-back', async () => {
  appStore.historyBack()
})

ipc.on('main-menu:history-forward', async () => {
  appStore.historyForward()
})

ipc.on('api:snippet-create', (event, body: Snippet) => {
  onCreateSnippet(body)
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
.top-notification {
  position: absolute;
  top: 5px;
  right: var(--spacing-sm);
  z-index: 1020;
  text-transform: uppercase;
  font-size: 10px;
  font-weight: bold;
  display: flex;
  gap: var(--spacing-sm);
}
.update {
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
