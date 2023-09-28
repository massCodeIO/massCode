<template>
  <div class="devtools">
    <div class="title">
      <h3>{{ i18n.t('menu:devtools.label') }}</h3>
      <AppActionButton
        v-tooltip="i18n.t('common:close')"
        @click="toHome"
      >
        <UniconsTimes />
      </AppActionButton>
    </div>
    <div class="body">
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
        </AppMenuGroup>
      </AppMenu>
    </div>
  </div>
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
// TODO: Рефакторинг двуколоночного меню
</script>

<style lang="scss" scoped>
.devtools {
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
