<script setup lang="ts">
import { event } from 'vue-gtag'
import assets from '../../_data/assets.json'

function trackDownload(platform: string, variant: string, url: string) {
  if (!import.meta.env.VITE_GA)
    return

  event('download_click', {
    platform,
    variant,
    link_url: url,
    transport_type: 'beacon',
  })
}
</script>

<template>
  <h2>macOS</h2>

  <VPButton
    :href="assets.macM1"
    theme="brand"
    text="Download for Apple Silicon"
    @click="trackDownload('macos', 'arm64', assets.macM1)"
  />

  <p>macOS 11.0+</p>

  <VPButton
    :href="assets.mac"
    theme="brand"
    text="Download for Intel"
    @click="trackDownload('macos', 'intel', assets.mac)"
  />

  <p>macOS 10.13+</p>

  <h2>Windows</h2>

  <div style="display: flex; gap: 12px">
    <VPButton
      :href="assets.win"
      theme="brand"
      text="Download for Windows"
      @click="trackDownload('windows', 'installer', assets.win)"
    />

    <VPButton
      :href="assets.winPortable"
      theme="brand"
      text="Download for Windows (portable)"
      @click="trackDownload('windows', 'portable', assets.winPortable)"
    />
  </div>

  <p>Windows 10, 11</p>

  <h2>Linux</h2>

  <VPButton
    :href="assets.linux"
    theme="brand"
    text="Download for Linux"
    @click="trackDownload('linux', 'appimage', assets.linux)"
  />

  <p>Ubuntu</p>
</template>
