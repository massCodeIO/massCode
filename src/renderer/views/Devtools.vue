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
    name: RouterName.devtoolsCaseConverter,
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
  {
    label: i18n.t('devtools:converters.colorConverter.label'),
    name: RouterName.devtoolsColorConverter,
  },
]

const cryptoNav = [
  {
    label: i18n.t('devtools:crypto.hash.label'),
    name: RouterName.devtoolsHash,
  },
  {
    label: i18n.t('devtools:crypto.hmac.label'),
    name: RouterName.devtoolsHmac,
  },
  {
    label: i18n.t('devtools:crypto.password.label'),
    name: RouterName.devtoolsPassword,
  },
  {
    label: i18n.t('devtools:crypto.uuid.label'),
    name: RouterName.devtoolsUuid,
  },
]

const webNav = [
  {
    label: i18n.t('devtools:web.urlParser.label'),
    name: RouterName.devtoolsUrlParser,
  },
  {
    label: i18n.t('devtools:web.urlEncoder.label'),
    name: RouterName.devtoolsUrlEncoder,
  },
  {
    label: i18n.t('devtools:web.slugify.label'),
    name: RouterName.devtoolsSlugify,
  },
]
</script>

<template>
  <LayoutTwoColumn
    :title="i18n.t('devtools:label')"
    @back="() => router.push({ name: RouterName.main })"
  >
    <template #left>
      <PerfectScrollbar
        class="h-full px-2"
        :options="{ minScrollbarLength: 20 }"
      >
        <div class="text-text-muted mb-2 text-[10px] uppercase">
          {{ i18n.t("devtools:converters.label") }}
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
          {{ i18n.t("devtools:crypto.label") }}
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
        <div class="text-text-muted my-2 text-[10px] uppercase">
          {{ i18n.t("devtools:web.label") }}
        </div>
        <RouterLink
          v-for="item in webNav"
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
      <PerfectScrollbar
        class="h-full px-5 pb-5"
        :options="{ minScrollbarLength: 20 }"
      >
        <RouterView />
      </PerfectScrollbar>
    </template>
  </LayoutTwoColumn>
</template>
