<template>
  <AppLayoutOneColumn
    :title="i18n.t('menu:devtools.label')"
    @close="toHome"
  >
    <AppMenu v-model="appStore.selectedDevtoolsMenu">
      <AppMenuGroup
        :label="i18n.t('devtools:textTools.label')"
        name="textTools"
      >
        <AppMenuItem
          group="textTools"
          :name="i18n.t('devtools:textTools.caseConverter')"
          value="textTools.caseConverter"
        >
          <CaseConverterTool />
        </AppMenuItem>
        <AppMenuItem
          group="textTools"
          :name="i18n.t('devtools:textTools.slugGenerator')"
          value="textTools.slugGenerator"
        >
          <SlugTool />
        </AppMenuItem>
        <AppMenuItem
          group="textTools"
          :name="i18n.t('devtools:textTools.sortLines')"
          value="textTools.sortLines"
        >
          <SortTool />
        </AppMenuItem>
        <AppMenuItem
          group="textTools"
          :name="i18n.t('devtools:textTools.urlParser')"
          value="textTools.urlParser"
        >
          <UrlParserTool />
        </AppMenuItem>
      </AppMenuGroup>
      <AppMenuGroup
        :label="i18n.t('devtools:crypto.label')"
        name="cryptoTools"
      >
        <AppMenuItem
          group="cryptoTools"
          :name="i18n.t('devtools:crypto.hashGenerator')"
          value="cryptoTools.hashGenerator"
        >
          <HashTool />
        </AppMenuItem>
        <AppMenuItem
          group="cryptoTools"
          :name="i18n.t('devtools:crypto.hmacGenerator')"
          value="cryptoTools.hmacGenerator"
        >
          <HmacTool />
        </AppMenuItem>
        <AppMenuItem
          group="cryptoTools"
          :name="i18n.t('devtools:crypto.passGenerator')"
          value="cryptoTools.passGenerator"
        >
          <PassTool />
        </AppMenuItem>
        <AppMenuItem
          group="cryptoTools"
          :name="i18n.t('devtools:crypto.uuidGenerator')"
          value="cryptoTools.uuidGenerator"
        >
          <UuidTool />
        </AppMenuItem>
      </AppMenuGroup>
      <AppMenuGroup
        :label="i18n.t('devtools:encodeDecode.label')"
        name="encodeDecodeTools"
      >
        <AppMenuItem
          group="encodeDecodeTools"
          :name="i18n.t('devtools:encodeDecode.url')"
          value="encodeDecode.url"
        >
          <UrlEncodeDecodeTool />
        </AppMenuItem>
        <AppMenuItem
          group="encodeDecodeTools"
          :name="i18n.t('devtools:encodeDecode.base64')"
          value="encodeDecode.base64"
        >
          <Base64EncodeDecodeTool />
        </AppMenuItem>
      </AppMenuGroup>
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

track('devtools')
</script>

<style lang="scss" scoped></style>
