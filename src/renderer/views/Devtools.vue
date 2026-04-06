<script setup lang="ts">
import { i18n } from '@/electron'
import { RouterName } from '@/router'
import { useRoute } from 'vue-router'

const route = useRoute()
const sidebarRef = useTemplateRef<HTMLElement>('sidebarRef')

onMounted(() => {
  nextTick(() => {
    const el = sidebarRef.value?.querySelector('[data-selected="true"]')
    el?.scrollIntoView({ block: 'center' })
  })
})

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

watch(
  () => route.name,
  (name) => {
    if (name && typeof name === 'string' && name.startsWith('devtools/')) {
      sessionStorage.setItem('devtools:lastRoute', name)
    }
  },
  { immediate: true },
)

const compareNav = [
  {
    label: i18n.t('devtools:compare.jsonDiff.label'),
    name: RouterName.devtoolsJsonDiff,
  },
]
</script>

<template>
  <LayoutTwoColumn
    :title="i18n.t('devtools:label')"
    :show-back="false"
  >
    <template #leftHeader>
      <div class="px-1 pt-[var(--content-top-offset)]">
        <SidebarHeader
          :title="i18n.t('devtools:label')"
          :section-title="i18n.t('devtools:converters.label')"
        />
      </div>
    </template>
    <template #left>
      <div
        ref="sidebarRef"
        class="scrollbar h-full min-h-0 overflow-y-auto px-2 pb-2"
      >
        <RouterLink
          v-for="item in convertersNav"
          :key="item.name"
          v-slot="{ navigate }"
          custom
          :to="{ name: item.name }"
        >
          <SidebarItem
            class="cursor-default"
            :selected="isActiveRoute(item.name)"
            @click="navigate"
          >
            <div class="flex h-[23px] items-center px-2 pl-5.5">
              <span class="min-w-0 truncate select-none">
                {{ item.label }}
              </span>
            </div>
          </SidebarItem>
        </RouterLink>
        <SidebarSectionHeader :title="i18n.t('devtools:crypto.label')" />
        <RouterLink
          v-for="item in cryptoNav"
          :key="item.name"
          v-slot="{ navigate }"
          custom
          :to="{ name: item.name }"
        >
          <SidebarItem
            class="cursor-default"
            :selected="isActiveRoute(item.name)"
            @click="navigate"
          >
            <div class="flex h-[23px] items-center px-2 pl-5.5">
              <span class="min-w-0 truncate select-none">
                {{ item.label }}
              </span>
            </div>
          </SidebarItem>
        </RouterLink>
        <SidebarSectionHeader :title="i18n.t('devtools:web.label')" />
        <RouterLink
          v-for="item in webNav"
          :key="item.name"
          v-slot="{ navigate }"
          custom
          :to="{ name: item.name }"
        >
          <SidebarItem
            class="cursor-default"
            :selected="isActiveRoute(item.name)"
            @click="navigate"
          >
            <div class="flex h-[23px] items-center px-2 pl-5.5">
              <span class="min-w-0 truncate select-none">
                {{ item.label }}
              </span>
            </div>
          </SidebarItem>
        </RouterLink>
        <SidebarSectionHeader :title="i18n.t('devtools:generators.label')" />
        <RouterLink
          v-for="item in generatorsNav"
          :key="item.name"
          v-slot="{ navigate }"
          custom
          :to="{ name: item.name }"
        >
          <SidebarItem
            class="cursor-default"
            :selected="isActiveRoute(item.name)"
            @click="navigate"
          >
            <div class="flex h-[23px] items-center px-2 pl-5.5">
              <span class="min-w-0 truncate select-none">
                {{ item.label }}
              </span>
            </div>
          </SidebarItem>
        </RouterLink>
        <SidebarSectionHeader :title="i18n.t('devtools:compare.label')" />
        <RouterLink
          v-for="item in compareNav"
          :key="item.name"
          v-slot="{ navigate }"
          custom
          :to="{ name: item.name }"
        >
          <SidebarItem
            class="cursor-default"
            :selected="isActiveRoute(item.name)"
            @click="navigate"
          >
            <div class="flex h-[23px] items-center px-2 pl-5.5">
              <span class="min-w-0 truncate select-none">
                {{ item.label }}
              </span>
            </div>
          </SidebarItem>
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
