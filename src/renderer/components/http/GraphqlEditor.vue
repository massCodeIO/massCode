<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import * as Select from '@/components/ui/shadcn/select'
import { useHttpSettings } from '@/composables'
import { i18n } from '@/electron'
import {
  buildGraphqlBody,
  graphqlOperations,
  readGraphqlDraft,
} from '~/shared/httpGraphql'

const model = defineModel<string | null>({ required: true })
const { settings } = useHttpSettings()
const draft = computed(() => {
  try {
    return readGraphqlDraft(model.value)
  }
  catch {
    return { query: model.value ?? '', variables: '{}', operationName: '' }
  }
})
function field(key: 'query' | 'variables' | 'operationName') {
  return computed({
    get: () => draft.value[key],
    set: (value: string) => {
      model.value = JSON.stringify({ ...draft.value, [key]: value })
    },
  })
}
const query = field('query')
const variables = field('variables')
const operationName = field('operationName')
const operations = computed(() => {
  try {
    return graphqlOperations(query.value).flatMap(operation =>
      operation.name ? [operation.name.value] : [],
    )
  }
  catch {
    return []
  }
})
const validation = computed(() => {
  if (!query.value.trim())
    return ''
  try {
    // Interpolated values are validated again by main after environment/session/scripts resolution.
    if (query.value.includes('{{') || variables.value.includes('{{'))
      return i18n.t('spaces.http.graphql.validationOnSend')
    buildGraphqlBody(JSON.stringify(draft.value))
    return ''
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return message.startsWith('GRAPHQL_')
      ? i18n.t(`spaces.http.graphql.errors.${message}`)
      : message
  }
})
</script>

<template>
  <div class="scrollbar flex min-h-0 flex-1 flex-col gap-2 overflow-auto">
    <UiText variant="caption">
      {{ i18n.t("spaces.http.graphql.query") }}
    </UiText>
    <HttpBodyEditor
      v-model="query"
      language="graphql"
      :wrap-lines="settings.wrapLines"
    />
    <div class="flex items-center gap-2">
      <UiText variant="caption">
        {{ i18n.t("spaces.http.graphql.operation") }}
      </UiText>
      <Select.Select
        v-model="operationName"
        :disabled="operations.length === 0"
      >
        <Select.SelectTrigger class="w-56">
          <Select.SelectValue
            :placeholder="
              i18n.t(
                operations.length
                  ? 'spaces.http.graphql.chooseOperation'
                  : 'spaces.http.graphql.noNamedOperations',
              )
            "
          />
        </Select.SelectTrigger>
        <Select.SelectContent>
          <Select.SelectItem
            v-for="operation in operations"
            :key="operation"
            :value="operation"
          >
            {{ operation }}
          </Select.SelectItem>
        </Select.SelectContent>
      </Select.Select>
      <Button
        v-if="operationName"
        variant="ghost"
        size="sm"
        @click="operationName = ''"
      >
        {{ i18n.t("spaces.http.graphql.clearOperation") }}
      </Button>
    </div>
    <UiText variant="caption">
      {{ i18n.t("spaces.http.graphql.variables") }}
    </UiText>
    <HttpBodyEditor
      v-model="variables"
      language="json"
      :wrap-lines="settings.wrapLines"
    />
    <UiText
      v-if="validation"
      variant="caption"
      class="text-destructive"
    >
      {{ validation }}
    </UiText>
    <UiText
      variant="caption"
      class="text-muted-foreground"
    >
      {{ i18n.t("spaces.http.graphql.schemaLimit") }}
    </UiText>
  </div>
</template>
