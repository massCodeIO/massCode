<script setup lang="ts">
import { db, ipc } from '@/electron'
import { reactive, ref } from 'vue'

const info = ref('')
const stats = reactive({
  folders: 0,
  snippets: 0,
  tags: 0,
})

ipc.send('request-info', null, (_, message) => {
  info.value = message
})

async function getStats() {
  try {
    const [{ folders }] = await db.query(
      'SELECT COUNT(*) as folders FROM folders',
    )
    stats.folders = folders

    const [{ snippets }] = await db.query(
      'SELECT COUNT(*) as snippets FROM snippets',
    )
    stats.snippets = snippets

    const [{ tags }] = await db.query('SELECT COUNT(*) as tags FROM tags')
    stats.tags = tags
  }
  catch (error) {
    console.error('Failed to get DB statistics:', error)
  }
}

getStats()
</script>

<template>
  <div class="app-title-bar absolute top-0 h-[30px] w-full select-none z-50" />
  <div
    class="container mx-auto p-4 flex flex-col items-center justify-center h-screen"
  >
    <img
      src="@/assets/logo.png"
      class="w-24 h-24"
    >
    <h1 class="text-3xl font-semibold _text-green-600">
      Electron Vue Boilerplate
    </h1>
    <nav class="mb-3 font-bold">
      <router-link to="/">
        Home
      </router-link>
      |
      <router-link to="/about">
        About
      </router-link>
    </nav>
    <RouterView />
    <div class="mt-4 text-gray-500 text-center">
      {{ info }}
      <br>
      <span class="font-bold">DB Stats:</span>
      <span> Folders: {{ stats.folders }}, </span>
      <span> Snippets: {{ stats.snippets }}, </span>
      <span> Tags: {{ stats.tags }} </span>
    </div>
  </div>
</template>

<style>
.app-title-bar {
  -webkit-app-region: drag;
}
</style>
