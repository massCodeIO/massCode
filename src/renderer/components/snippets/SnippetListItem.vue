<template>
  <div class="item">
    <div class="header">
      <div class="name">
        <span> snippet name </span>
      </div>
    </div>
    <div class="footer">
      <div class="folder">
        folder
      </div>
      <div class="date">
        19/03/2022
      </div>
    </div>
  </div>
</template>

<script setup lang="ts"></script>

<style lang="scss" scoped>
.item {
  // height: 100px;
  padding: var(--spacing-xs);
  border-bottom: 1px solid var(--color-border);
}
.name {
  display: table;
  table-layout: fixed;
  width: 100%;
  overflow: hidden;
  span {
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
  }
}
.footer {
  font-size: 11px;
  display: flex;
  justify-content: space-between;
  color: var(--color-contrast-medium);
  padding-top: var(--spacing-xs);
}
</style>
