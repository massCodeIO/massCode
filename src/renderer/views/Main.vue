<script setup lang="ts"></script>

<template>
  <div
    class="h-screen grid grid-cols-[var(--sidebar-width)_var(--snippet-list-width)_1fr]"
  >
    <Sidebar />
    <SnippetList />
    <Editor />
  </div>
</template>
