<script setup lang="ts">
import { i18n } from '@/electron'
import { router, RouterName } from '@/router'
import { useRoute } from 'vue-router'

const route = useRoute()

const isActiveRoute = computed(() => {
  return (name: string) => route.name === name
})

const convertersNav = [
  {
    label: i18n.t('devtools:converters.caseConverter.label'),
    name: RouterName.devtoolsTextCaseConverter,
  },
  {
    label: i18n.t('devtools:converters.textToUnicode.label'),
    name: RouterName.devtoolsTextToUnicode,
  },
  {
    label: i18n.t('devtools:converters.textToAscii.label'),
    name: RouterName.devtoolsTextToAscii,
  },
  {
    label: i18n.t('devtools:converters.base64.label'),
    name: RouterName.devtoolsBase64Converter,
  },
  {
    label: i18n.t('devtools:converters.jsonToYaml.label'),
    name: RouterName.devtoolsJsonToYaml,
  },
  {
    label: i18n.t('devtools:converters.jsonToToml.label'),
    name: RouterName.devtoolsJsonToToml,
  },
  {
    label: i18n.t('devtools:converters.jsonToXml.label'),
    name: RouterName.devtoolsJsonToXml,
  },
]

const cryptoNav = [
  {
    label: i18n.t('devtools:crypto.hash.label'),
    name: RouterName.devtoolsHash,
  },
]
</script>

<template>
  <LayoutTwoColumn
    :title="i18n.t('devtools:label')"
    @back="() => router.push({ name: RouterName.main })"
  >
    <template #left>
      <PerfectScrollbar class="h-full px-2">
        <div class="text-text-muted mb-2 text-[10px] uppercase">
          {{ i18n.t("devtools:group.converters") }}
        </div>
        <RouterLink
          v-for="item in convertersNav"
          :key="item.name"
          class="cursor-default"
          :to="{ name: item.name }"
        >
          <UiMenuItem
            :label="item.label"
            :is-active="isActiveRoute(item.name)"
          />
        </RouterLink>
        <div class="text-text-muted my-2 text-[10px] uppercase">
          {{ i18n.t("devtools:group.crypto") }}
        </div>
        <RouterLink
          v-for="item in cryptoNav"
          :key="item.name"
          class="cursor-default"
          :to="{ name: item.name }"
        >
          <UiMenuItem
            :label="item.label"
            :is-active="isActiveRoute(item.name)"
          />
        </RouterLink>
      </PerfectScrollbar>
    </template>
    <template #right>
      <PerfectScrollbar class="h-full px-5 pb-5">
        <RouterView />
      </PerfectScrollbar>
    </template>
  </LayoutTwoColumn>
</template>
