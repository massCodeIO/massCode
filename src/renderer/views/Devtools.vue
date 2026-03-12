<script setup lang="ts">
import { i18n } from '@/electron'
import { RouterName } from '@/router'
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

const generatorsNav = [
  {
    label: i18n.t('devtools:generators.json.label'),
    name: RouterName.devtoolsJsonGenerator,
  },
  {
    label: i18n.t('devtools:generators.lorem.label'),
    name: RouterName.devtoolsLoremIpsumGenerator,
  },
]

const uiNav = [
  {
    label: 'shadcn demo',
    name: RouterName.devtoolsShadcnComparison,
  },
]
</script>

<template>
  <LayoutTwoColumn
    :title="i18n.t('devtools:label')"
    :show-back="false"
  >
    <template #left>
      <div class="scrollbar h-full min-h-0 overflow-y-auto px-2">
        <div class="text-muted-foreground mb-2 text-[10px] uppercase">
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
        <div class="text-muted-foreground my-2 text-[10px] uppercase">
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
        <div class="text-muted-foreground my-2 text-[10px] uppercase">
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
        <div class="text-muted-foreground my-2 text-[10px] uppercase">
          {{ i18n.t("devtools:generators.label") }}
        </div>
        <RouterLink
          v-for="item in generatorsNav"
          :key="item.name"
          class="cursor-default"
          :to="{ name: item.name }"
        >
          <UiMenuItem
            :label="item.label"
            :is-active="isActiveRoute(item.name)"
          />
        </RouterLink>
        <div class="text-muted-foreground my-2 text-[10px] uppercase">
          demo
        </div>
        <RouterLink
          v-for="item in uiNav"
          :key="item.name"
          class="cursor-default"
          :to="{ name: item.name }"
        >
          <UiMenuItem
            :label="item.label"
            :is-active="isActiveRoute(item.name)"
          />
        </RouterLink>
      </div>
    </template>
    <template #right>
      <div class="scrollbar h-full min-h-0 overflow-y-auto px-5 pb-5">
        <RouterView />
      </div>
    </template>
  </LayoutTwoColumn>
</template>
