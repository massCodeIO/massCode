<template>
  <div class="custom-language-preferences">
    <div>
      <em>Custom Languages provide access to filetypes outside of the included
        languages. This can be used for custom filetype support in vim or other
        editors. The surrogate language is used for syntax highlighting in the
        editor. It makes the custom filetype look like the selected
        language.</em>
    </div>
    <AppForm>
      <ul>
        <li
          v-for="(customLanguage, index) in customLanguages"
          :key="index"
        >
          <div>
            <h4>
              {{
                customLanguages[index].name.length > 0
                  ? customLanguages[index].name
                  : 'New'
              }}
            </h4>
            <AppFormItem label="Name">
              <AppInput
                v-model="customLanguages[index].name"
                @change="
                  onUpdateCustomLanguage('name', $event.target.value, index)
                "
              />
            </AppFormItem>
            <AppFormItem label="Value">
              <AppInput
                v-model="customLanguages[index].value"
                @change="
                  onUpdateCustomLanguage('value', $event.target.value, index)
                "
              />
            </AppFormItem>
            <AppFormItem label="Surrogate Language">
              <AppSelect
                v-model="customLanguages[index].surrogate"
                :options="languageOptions"
                @change="
                  onUpdateCustomLanguage(
                    'surrogate',
                    $event.target.value,
                    index
                  )
                "
              />
            </AppFormItem>
            <AppFormItem label="">
              <AppButton @click="removeCustomLanguage(index)">
                Remove Option
              </AppButton>
            </AppFormItem>
          </div>
        </li>
      </ul>
      <AppFormItem label="">
        <AppButton @click="onNewCustomLanguage">
          Add New Custom Language
        </AppButton>
      </AppFormItem>
    </AppForm>
  </div>
</template>

<script setup lang="ts">
import { usePreferencesStore } from '@/store/preferences'
import { languages } from '../../components/editor/languages'

const preferencesStore = usePreferencesStore()
const languageOptions = languages.reduce(
  (acc, option) => [...acc, { label: option.name, value: option.value }],
  [{ label: 'No Surrogate', value: '' }]
)

const customLanguages = preferencesStore.customLanguages

const onNewCustomLanguage = () => {
  customLanguages.push({ name: '', value: '' })
}

const onUpdateCustomLanguage = (key, value, index) => {
  customLanguages[index][key] = value
  preferencesStore.upsertCustomLanguage(customLanguages[index], index)
}

const removeCustomLanguage = (index: number) => {
  preferencesStore.removeCustomLanguage(index)
}
</script>

<style lang="scss" scoped>
ul {
  list-style: none;
  margin-top: 0;
  padding-left: 0;

  li {
    .form-item {
      padding-bottom: 1em;
    }
  }
}
</style>
