<template>
  <div class="snippet-screenshot">
    <div
      class="tools"
      :class="{ 'no-top-border': snippetStore.isFragmentsShow }"
    >
      <div class="left">
        <div class="tools__item">
          <AppCheckbox
            v-model="appStore.screenshot.background"
            name="background"
            :label="i18n.t('background')"
          />
        </div>
        <div class="tools__item">
          <AppCheckbox
            v-model="appStore.screenshot.darkMode"
            name="darkMode"
            :label="i18n.t('darkMode')"
          />
        </div>
        <div class="tools__item">
          <ScreenshotPalette v-model="appStore.screenshot.gradient" />
        </div>
      </div>
      <div class="right">
        <AppActionButton
          v-tooltip="i18n.t('saveScreenshot')"
          @click="onSaveScreenshot"
        >
          <UniconsFileDownload />
        </AppActionButton>
      </div>
    </div>
    <PerfectScrollbar>
      <div class="content">
        <div
          ref="frameRef"
          class="frame"
        >
          <div
            ref="snippetRef"
            class="background"
            :style="colorBgStyle"
          >
            <div class="body">
              <div class="window-controls">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="54"
                  height="14"
                  viewBox="0 0 54 14"
                >
                  <g
                    fill="none"
                    fill-rule="evenodd"
                    transform="translate(1 1)"
                  >
                    <circle
                      cx="6"
                      cy="6"
                      r="6"
                      fill="#FF5F56"
                      stroke="#E0443E"
                      stroke-width=".5"
                    />
                    <circle
                      cx="26"
                      cy="6"
                      r="6"
                      fill="#FFBD2E"
                      stroke="#DEA123"
                      stroke-width=".5"
                    />
                    <circle
                      cx="46"
                      cy="6"
                      r="6"
                      fill="#27C93F"
                      stroke="#1AAB29"
                      stroke-width=".5"
                    />
                  </g>
                </svg>
              </div>
              <div v-html="renderer" />
            </div>
          </div>
          <div class="transparent" />
          <div
            ref="gutterRef"
            class="gutter"
          />
        </div>
      </div>
    </PerfectScrollbar>
    <div
      ref="previewRef"
      class="preview"
    />
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from '@/store/app'
import hljs from 'highlight.js'
import html2canvas from 'html2canvas'
import interact from 'interactjs'
import { computed, onMounted, ref, watch } from 'vue'
import { useHljsTheme } from '@/composable'
import { store, track, i18n } from '@/electron'
import { useSnippetStore } from '@/store/snippets'
import { useMagicKeys } from '@vueuse/core'

const GUTTER_RIGHT_OFFSET = 10
const GUTTER_WIDTH = 8
const MAX_WIDTH = 920
const MIN_WIDTH = 520

interface Props {
  snippet: string
  lang: string
  name: string
}

const props = defineProps<Props>()

const appStore = useAppStore()
const snippetStore = useSnippetStore()
const { escape } = useMagicKeys()

const frameRef = ref<HTMLElement>()
const snippetRef = ref<HTMLElement>()
const previewRef = ref<HTMLElement>()
const gutterRef = ref<HTMLElement>()

const gutterWidth = ref(GUTTER_WIDTH + 'px')
const offsetGutterRight = ref(GUTTER_RIGHT_OFFSET + 'px')

const forceRefresh = ref()

const font = computed(() => appStore.editor.fontFamily)
const frameWidthC = computed(() => appStore.screenshot.width + 'px')
const transparentOpacity = computed(() =>
  appStore.isLightTheme ? '75%' : '10%'
)
const colorBodyBg = computed(() =>
  appStore.screenshot.darkMode ? '#263238' : '#fff'
)
const colorBgStyle = computed(() => {
  if (!appStore.screenshot.background) return
  return {
    backgroundImage: `linear-gradient(45deg, ${appStore.screenshot.gradient[0]}, ${appStore.screenshot.gradient[1]})`
  }
})

const renderer = computed(() => {
  const language = hljs.getLanguage(props.lang) ? props.lang : 'plaintext'
  return `<pre><code class="language-${props.lang} hljs">${
    hljs.highlight(props.snippet, { language }).value
  }</code></pre>`
})

const height = computed(() => {
  // eslint-disable-next-line no-unused-expressions
  forceRefresh.value

  const result =
    appStore.sizes.editor.titleHeight +
    appStore.sizes.titlebar +
    appStore.sizes.editor.footerHeight

  return window.innerHeight - result + 'px'
})

const init = () => {
  hljs.registerAliases('apache_conf', { languageName: 'apache' })
  hljs.registerAliases('c_cpp', { languageName: 'cpp' })
  hljs.registerAliases('graphqlschema', { languageName: 'graphql' })
}

const onSaveScreenshot = async () => {
  const canvas = await html2canvas(snippetRef.value!, {
    backgroundColor: null
  })
  previewRef.value?.appendChild(canvas)

  const a = document.createElement('a')
  const img = canvas.toDataURL('image/png')

  a.href = img
  a.download = `${props.name}.png`
  a.click()
  track('snippets/create-screenshot')
}

watch(
  () => appStore.screenshot.darkMode,
  v => {
    if (v) {
      useHljsTheme('dark')
    } else {
      useHljsTheme('light')
    }
  },
  { immediate: true }
)

watch(
  () => appStore.screenshot,
  v => {
    store.preferences.set('screenshot', JSON.parse(JSON.stringify(v)))
  },
  { deep: true }
)

watch(escape, () => {
  snippetStore.isScreenshotPreview = false
})

onMounted(() => {
  interact(frameRef.value!).resizable({
    allowFrom: gutterRef.value!,
    onmove: e => {
      const { pageX } = e
      const gutterOffset = GUTTER_RIGHT_OFFSET + GUTTER_WIDTH / 2
      const width = Math.floor(
        pageX -
          appStore.sizes.sidebar -
          appStore.sizes.snippetList +
          gutterOffset
      )

      appStore.screenshot.width = width

      if (width < MIN_WIDTH) {
        appStore.screenshot.width = 520
      }

      if (width > MAX_WIDTH) {
        appStore.screenshot.width = 920
      }
    }
  })
})

window.addEventListener('resize', () => {
  forceRefresh.value = Math.random()
})

init()
</script>

<style lang="scss" scoped>
.snippet-screenshot {
  --color-bg-transparent: hsla(0, 0%, v-bind(transparentOpacity));

  :deep(code) {
    font-family: v-bind(font) !important;
  }
  :deep(pre) {
    white-space: pre-wrap;
    font-size: 12px;
  }
  :deep(code) {
    padding: 0;
  }
  :deep(.ps) {
    height: v-bind(height);
  }
  .tools {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px var(--spacing-xs);
    border-top: 1px solid var(--color-border);
    border-bottom: 1px solid var(--color-border);
    &.no-top-border {
      border-top: none;
    }
    .left {
      gap: var(--spacing-sm);
      align-items: center;
      display: flex;
    }
  }
  .content {
    flex: 1;
    display: flex;
  }
  .frame {
    position: relative;
    width: v-bind(frameWidthC);
    min-width: 520px;
    max-width: 920px;
  }

  .background {
    position: relative;
    padding: var(--spacing-lg);
    z-index: 10;
  }
  .transparent {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image: linear-gradient(
        45deg,
        var(--color-bg-transparent) 25%,
        transparent 0
      ),
      linear-gradient(-45deg, var(--color-bg-transparent) 25%, transparent 0),
      linear-gradient(45deg, transparent 75%, var(--color-bg-transparent) 0),
      linear-gradient(-45deg, transparent 75%, var(--color-bg-transparent) 0);
    background-size: 20px 20px;
    background-position: 0 0, 0 10px, 10px -10px, -10px 0;
    z-index: 1;
  }

  .gutter {
    position: absolute;
    width: v-bind(gutterWidth);
    height: 40px;
    background-color: var(--color-contrast-medium);
    right: v-bind(offsetGutterRight);
    border-radius: 10px;
    top: 50%;
    transform: translateY(-50%);
    z-index: 100;
    cursor: col-resize;
  }

  .body {
    padding: var(--spacing-sm);
    border-radius: 12px;
    background-color: v-bind(colorBodyBg);
    user-select: none;
  }
}
</style>
