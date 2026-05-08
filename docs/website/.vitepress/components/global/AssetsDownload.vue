<script setup lang="ts">
import assets from '../../_data/assets.json'
</script>

<template>
  <h2>macOS</h2>

  <VPButton
    :href="assets.macM1"
    theme="brand"
    text="Download for Apple Silicon"
  />

  <p>macOS 11.0+</p>

  <VPButton
    :href="assets.mac"
    theme="brand"
    text="Download for Intel"
  />

  <p>macOS 10.13+</p>

  <h3>Opening unsigned macOS builds</h3>

  <p>
    The macOS app is not code-signed. If macOS says that massCode is damaged or
    cannot be opened, allow it in <strong>System Settings</strong> >
    <strong>Privacy & Security</strong>, or remove the quarantine attribute:
  </p>

  <div class="language-bash">
    <pre><code>sudo xattr -r -d com.apple.quarantine /Applications/massCode.app</code></pre>
  </div>

  <h2>Windows</h2>

  <div style="display: flex; gap: 12px">
    <VPButton
      :href="assets.win"
      theme="brand"
      text="Download for Windows"
    />

    <VPButton
      :href="assets.winPortable"
      theme="brand"
      text="Download for Windows (portable)"
    />
  </div>

  <p>Windows 10, 11</p>

  <h2>Linux</h2>

  <VPButton
    :href="assets.linux"
    theme="brand"
    text="Download for Linux"
  />

  <p>Ubuntu</p>
</template>
