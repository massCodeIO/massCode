<template>
  <div class="header">
    <div class="top">
      <div class="name">
        <input
          ref="inputRef"
          v-model="name"
          type="text"
          :placeholder="i18n.t('snippet.emptyName')"
        >
      </div>
      <div class="action">
        <AppActionButton
          v-if="snippetStore.currentLanguage === 'markdown'"
          v-tooltip="i18n.t('menu:editor.previewMarkdown')"
          tabindex="-1"
          @click="onClickPresentationMode"
        >
          <UniconsMeetingBoard />
        </AppActionButton>
        <template v-if="snippetStore.currentLanguage === 'markdown'">
          <AppActionButton
            v-tooltip="
              !snippetStore.isMarkdownPreview
                ? i18n.t('menu:editor.previewMarkdown')
                : i18n.t('hide') + ' ' + i18n.t('menu:editor.previewMarkdown')
            "
            tabindex="-1"
            :active="snippetStore.isMarkdownPreview"
            @click="onClickMarkdownPreview"
          >
            <UniconsEye />
          </AppActionButton>
          <AppActionButton
            v-tooltip="i18n.t('menu:editor.previewMindmap')"
            tabindex="-1"
            :active="snippetStore.isMindmapPreview"
            @click="onClickMindmapPreview"
          >
            <UniconsCodeBranch class="mindmap" />
          </AppActionButton>
        </template>
        <AppActionButton
          v-tooltip="
            !isShareActive
              ? i18n.t('menu:Share')
              : i18n.t('hide') + ' ' + i18n.t('menu:Share')
          "
          tabindex="-1"
          :active="isShareActive"
          @click="toggleShareMenu"
        >
          <UniconsShare />
        </AppActionButton>
        <div
          v-if="isShareActive"
          class="share-menu"
        >
          <AppActionButton
            v-tooltip="i18n.t(' shareToQzone ')"
            @click="shareTo('qzone')"
          >
            <svg
              class="botton1"
              xmlns="http://www.w3.org/2000/svg"
              width="128"
              height="128"
              viewBox="0 0 24 24"
            >
              <path
                fill="currentColor"
                d="M23.987 9.201c-.032-.099-.127-.223-.334-.258S16.3 7.537 16.3 7.537s-.105-.022-.198-.07c-.092-.047-.127-.167-.127-.167S12.447.954 12.349.768C12.25.58 12.104.53 12 .53s-.25.05-.349.238C11.553.954 8.025 7.3 8.025 7.3s-.036.12-.129.167c-.092.047-.197.07-.197.07S.555 8.907.347 8.942c-.208.036-.302.16-.333.258a.48.48 0 0 0 .125.45L5.5 15.14s.072.08.12.172c.015.104.004.21.004.21s-1.189 7.243-1.22 7.451a.46.46 0 0 0 .16.43c.082.062.232.106.42.013c.19-.093 6.813-3.261 6.813-3.261s.098-.044.201-.061s.201.06.201.06s6.624 3.17 6.813 3.262c.188.094.338.05.421-.013a.46.46 0 0 0 .16-.43l-.93-5.678c.875-.54 1.424-1.039 1.848-1.747c-2.594.97-6.007 1.717-9.416 1.866c-.915.041-2.41.097-3.473-.015c-.679-.07-1.17-.144-1.244-.438c-.053-.215.054-.46.545-.83l2.862-2.156c1.285-.968 3.56-2.47 3.56-2.732c0-.285-2.145-.78-4.038-.78c-1.945 0-2.276.131-2.812.167c-.488.034-.769.005-.804-.138c-.06-.248.183-.389.588-.568c.71-.314 1.86-.594 1.985-.626c.194-.052 3.082-.805 5.618-.535c1.319.14 3.245.668 3.245 1.276c0 .342-1.721 1.495-3.226 2.598c-1.149.843-2.217 1.56-2.217 1.688c0 .342 3.534 1.241 6.69 1.01l.003-.022c.048-.092.12-.172.12-.172l5.362-5.49a.48.48 0 0 0 .127-.45"
              />
            </svg>
          </AppActionButton>
          <AppActionButton
            v-tooltip="i18n.t('shareToSina')"
            @click="shareTo('sina')"
          >
            <svg
              class="botton1"
              xmlns="http://www.w3.org/2000/svg"
              width="128"
              height="128"
              viewBox="0 0 20 20"
            >
              <path
                fill="currentColor"
                d="M14.812 9.801c-.778-.141-.4-.534-.4-.534s.761-1.178-.15-2.034c-1.13-1.061-3.877.135-3.877.135c-1.05.306-.77-.14-.622-.897c0-.892-.326-2.402-3.12-1.51C3.853 5.858 1.455 9 1.455 9C-.212 11.087.01 12.7.01 12.7c.416 3.562 4.448 4.54 7.584 4.771c3.299.243 7.752-1.067 9.102-3.76c1.35-2.696-1.104-3.763-1.884-3.91m-1.044 2.549c0 2.051-2.653 3.977-5.93 4.117c-3.276.144-5.923-1.398-5.923-3.45c0-2.054 2.647-3.7 5.923-3.842s5.93 1.126 5.93 3.175m-6.584-1.823c-3.293.362-2.913 3.259-2.913 3.259s-.034.917.883 1.384c1.927.98 3.912.387 4.915-.829s.415-4.173-2.885-3.814m.281 3.075c0 .48-.498.925-1.112.99c-.614.068-1.11-.265-1.11-.747s.44-.985 1.055-1.045c.707-.064 1.167.318 1.167.802m1.003-1.15c.11.174.031.437-.173.588c-.208.146-.464.126-.574-.05c-.115-.17-.072-.445.139-.588c.244-.171.498-.122.608.05m4.86-9.806c.335-.06 1.532-.281 2.696-.025c2.083.456 4.941 2.346 3.655 6.368c-.094.575-.398.62-.76.62c-.432 0-.781-.255-.781-.662c0-.352.155-.71.155-.71c.046-.148.411-1.07-.241-2.448c-1.198-1.887-3.609-1.915-3.893-1.807a3.5 3.5 0 0 1-.591.141l-.106.016l-.014.002c-.437 0-.786-.333-.786-.737a.75.75 0 0 1 .573-.715s.007-.011.018-.014c.024-.004.049-.027.075-.029m.66 2.611s3.367-.584 2.964 2.811a.2.2 0 0 1-.007.054c-.037.241-.264.426-.529.426c-.3 0-.543-.225-.543-.507c0 0 .534-2.269-1.885-1.768c-.299 0-.538-.227-.538-.505c0-.283.24-.51.538-.51"
              />
            </svg>
          </AppActionButton>
          <AppActionButton
            v-tooltip="i18n.t('shareToQQ')"
            @click="shareTo('qq')"
          >
            <svg
              class="botton1"
              xmlns="http://www.w3.org/2000/svg"
              width="128"
              height="128"
              viewBox="0 0 20 20"
            >
              <path
                fill="currentColor"
                d="M18.496 13.607c-.134-1.931-1.372-3.55-2.088-4.387c.1-.243.341-1.653-.593-2.615q.003-.035.002-.068C15.817 2.743 13.237.012 10 0C6.763.013 4.183 2.743 4.183 6.537q0 .035.002.068c-.934.962-.692 2.372-.593 2.615c-.715.837-1.953 2.456-2.088 4.387c-.024.508.051 1.248.288 1.577c.289.4 1.081-.081 1.648-1.362c.158.594.521 1.5 1.345 2.649c-1.378.33-1.771 1.752-1.307 2.53c.327.548 1.075.999 2.365.999c2.296 0 3.31-.645 3.763-1.095q.138-.147.394-.146q.256-.001.394.146c.453.45 1.467 1.095 3.762 1.095c1.29 0 2.039-.45 2.366-.999c.464-.778.07-2.2-1.307-2.53c.824-1.15 1.188-2.055 1.345-2.649c.567 1.281 1.36 1.763 1.648 1.362c.237-.33.312-1.07.288-1.577"
              />
            </svg>
          </AppActionButton>
          <AppActionButton
            v-tooltip="i18n.t('shareToWechat')"
            @click="shareTo('wechat')"
          >
            <svg
              class="botton1"
              xmlns="http://www.w3.org/2000/svg"
              width="128"
              height="128"
              viewBox="0 0 24 24"
            >
              <path
                fill="currentColor"
                d="M9.5 4C5.36 4 2 6.69 2 10c0 1.89 1.08 3.56 2.78 4.66L4 17l2.5-1.5c.89.31 1.87.5 2.91.5A5.2 5.2 0 0 1 9 14c0-3.31 3.13-6 7-6c.19 0 .38 0 .56.03C15.54 5.69 12.78 4 9.5 4m-3 2.5a1 1 0 0 1 1 1a1 1 0 0 1-1 1a1 1 0 0 1-1-1a1 1 0 0 1 1-1m5 0a1 1 0 0 1 1 1a1 1 0 0 1-1 1a1 1 0 0 1-1-1a1 1 0 0 1 1-1M16 9c-3.31 0-6 2.24-6 5s2.69 5 6 5c.67 0 1.31-.08 1.91-.25L20 20l-.62-1.87C20.95 17.22 22 15.71 22 14c0-2.76-2.69-5-6-5m-2 2.5a1 1 0 0 1 1 1a1 1 0 0 1-1 1a1 1 0 0 1-1-1a1 1 0 0 1 1-1m4 0a1 1 0 0 1 1 1a1 1 0 0 1-1 1a1 1 0 0 1-1-1a1 1 0 0 1 1-1"
              />
            </svg>
          </AppActionButton>
        </div>
        <AppActionButton
          v-tooltip="
            !snippetStore.isScreenshotPreview
              ? i18n.t('menu:editor.previewScreenshot')
              : i18n.t('hide') + ' ' + i18n.t('menu:editor.previewScreenshot')
          "
          tabindex="-1"
          :active="snippetStore.isScreenshotPreview"
          @click="onClickScreenshotPreview"
        >
          <UniconsCamera />
        </AppActionButton>
        <AppActionButton
          v-tooltip="
            !snippetStore.isCodePreview
              ? i18n.t('menu:editor.previewCode')
              : i18n.t('hide') + ' ' + i18n.t('menu:editor.previewCode')
          "
          tabindex="-1"
          :active="snippetStore.isCodePreview"
          @click="onCodePreview"
        >
          <UniconsArrow />
        </AppActionButton>
        <AppActionButton
          v-tooltip="i18n.t('addDescription')"
          tabindex="-1"
          @click="onAddDescription"
        >
          <UniconsText />
        </AppActionButton>
        <AppActionButton
          v-tooltip="i18n.t('newFragment')"
          tabindex="-1"
          @click="onAddNewFragment"
        >
          <UniconsPlus />
        </AppActionButton>
      </div>
    </div>
    <div class="bottom">
      <SnippetsDescription v-show="snippetStore.isDescriptionShow" />
      <SnippetFragments v-if="snippetStore.isFragmentsShow" />
      <SnippetsTags v-if="isTagsShow" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onAddNewFragment, onAddDescription, emitter } from '@/composable'
import { useSnippetStore } from '@/store/snippets'
import { useDebounceFn } from '@vueuse/core'
import { computed, onUnmounted, ref } from 'vue'
import { useAppStore } from '@/store/app'
import { i18n } from '@/electron'
import { track } from '@/services/analytics'
import { useRouter } from 'vue-router'

const snippetStore = useSnippetStore()
const appStore = useAppStore()
const router = useRouter()
const isShareActive = ref(false)
const inputRef = ref<HTMLInputElement>()

const headerHeight = appStore.sizes.editor.titleHeight + 'px'

const toggleShareMenu = () => {
  isShareActive.value = !isShareActive.value
}

const shareTo = (platform: string) => {
  const title = document.title
  const url = window.location.href
  const description =
    document
      .querySelector('meta[name="description"]')
      ?.getAttribute('content') || ''

  if (platform === 'qzone') {
    window.open(
      `https://sns.qzone.qq.com/cgi-bin/qzshare/cgi_qzshare_onekey?url=${url}&title=${title}&summary=${description}`
    )
  } else if (platform === 'sina') {
    window.open(
      `http://service.weibo.com/share/share.php?url=${url}&title=${title}&appkey=70876773`
    )
  } else if (platform === 'qq') {
    window.open(
      `http://connect.qq.com/widget/shareqq/index.html?url=${url}&title=${title}&summary=${description}`
    )
  } else if (platform === 'wechat') {
    // 生成二维码给微信扫描分享
    window.open(`http://zixuephp.net/inc/qrcode_img.php?url=${url}`)
  }
}

const name = computed({
  get: () => snippetStore.selected?.name,
  set: useDebounceFn(
    v =>
      snippetStore.patchSnippetsById(snippetStore.selectedId!, { name: v }),
    300
  )
})

const isTagsShow = computed(() => {
  return (
    snippetStore.isTagsShow &&
    !snippetStore.isScreenshotPreview &&
    !snippetStore.isMarkdownPreview &&
    !snippetStore.isMindmapPreview
  )
})

const onClickMarkdownPreview = () => {
  snippetStore.togglePreview('markdown')
  track('snippets/markdown-preview')
}

const onClickMindmapPreview = () => {
  snippetStore.togglePreview('mindmap')
  track('snippets/mindmap-preview')
}

const onClickScreenshotPreview = () => {
  snippetStore.togglePreview('screenshot')
  track('snippets/screenshot-preview')
}
const onCodePreview = () => {
  snippetStore.togglePreview('code')
  track('snippets/code-preview')
}

const onClickPresentationMode = () => {
  router.push('/presentation')
}

emitter.on('snippet:focus-name', () => {
  inputRef.value?.select()
})

onUnmounted(() => {
  emitter.off('snippet:focus-name')
})
</script>

<style lang="scss" scoped>
.header {
  .top {
    padding: 0 var(--spacing-xs);
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: v-bind(headerHeight);
    position: relative;
    top: var(--title-bar-height-offset);
  }
  .name {
    font-size: 16px;
    width: 100%;
    input {
      border: 0;
      width: 100%;
      outline: none;
      line-height: 32px;
      text-overflow: ellipsis;
      background-color: var(--color-bg);
      color: var(--color-text);
    }
  }
  .action {
    display: flex;

    .mindmap {
      transform: rotate(90deg);
    }
  }
}
.share-container {
  display: flex;
  position: relative;
}
.botton1 {
  width: 20px;
  height: 20px;
}
.share-menu {
  display: flex;
  flex-direction: column;
  position: absolute;
  top: 40px; /* 调整菜单位置 */
  background-color: #fff;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 8px;
  z-index: 10;
}
</style>
