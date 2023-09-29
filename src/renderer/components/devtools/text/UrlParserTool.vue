<template>
  <div class="url-parser-tool">
    <AppForm>
      <AppFormItem :label="i18n.t('devtools:form.inputUrl')">
        <AppInput
          v-model="inputValue"
          style="width: 100%"
        />
      </AppFormItem>
      <AppFormItem :label="i18n.t('devtools:form.parsedUrl')">
        <table class="table">
          <colgroup>
            <col width="20%">
            <col width="80%">
          </colgroup>
          <thead>
            <tr>
              <th>{{ i18n.t('devtools:form.component') }}</th>
              <th>{{ i18n.t('devtools:form.value') }}</th>
            </tr>
          </thead>
          <tr>
            <td>Protocol</td>
            <td>{{ protocol }}</td>
          </tr>
          <tr>
            <td>Hash</td>
            <td>{{ hash }}</td>
          </tr>
          <tr>
            <td>Query</td>
            <td>{{ query }}</td>
          </tr>
          <tr>
            <td>Pathname</td>
            <td>{{ pathname }}</td>
          </tr>
          <tr>
            <td>Host</td>
            <td>{{ host }}</td>
          </tr>
          <tr>
            <td>Port</td>
            <td>{{ port }}</td>
          </tr>
          <tr>
            <td>Hostname</td>
            <td>{{ hostname }}</td>
          </tr>
          <tr>
            <td>Origin</td>
            <td>{{ origin }}</td>
          </tr>
        </table>
      </AppFormItem>
      <AppFormItem :label="i18n.t('devtools:form.splitQueryString')">
        <table class="table">
          <colgroup>
            <col width="20%">
            <col width="80%">
          </colgroup>
          <thead>
            <tr>
              <th>{{ i18n.t('devtools:form.key') }}</th>
              <th>{{ i18n.t('devtools:form.value') }}</th>
            </tr>
          </thead>
          <tr
            v-for="(v, k) in queryObj"
            :key="k"
          >
            <td>{{ k }}</td>
            <td>{{ v }}</td>
          </tr>
        </table>
      </AppFormItem>
    </AppForm>
  </div>
</template>

<script setup lang="ts">
import { i18n } from '@/electron'
import { track } from '@/services/analytics'
import { computed, ref } from 'vue'
import qs from 'query-string'

const inputValue = ref('')

const url = computed<URL | undefined>(() => {
  let url: URL | undefined

  try {
    url = new URL(inputValue.value)
    return url
  } catch (err) {}
  return url
})

const protocol = computed(() => url.value?.protocol)
const hash = computed(() => url.value?.hash)
const query = computed(() => url.value?.search)
const pathname = computed(() => url.value?.pathname)
const host = computed(() => url.value?.host)
const hostname = computed(() => url.value?.hostname)
const origin = computed(() => url.value?.origin)
const port = computed(() => url.value?.port)

const queryObj = computed(() => qs.parse(query?.value || ''))

track('devtools/url-parser')
</script>

<style lang="scss" scoped></style>
