<template>
  <div class="debug">
    <pre>
<slot />
    </pre>
  </div>
</template>

<script setup lang="ts"></script>

<style lang="scss" scoped>
.debug {
  position: absolute;
  right: 10px;
  bottom: 10px;
  background-color: #fff;
  width: 400px;
  max-height: 400px;
  overflow: scroll;
  padding: 0 var(--spacing-xs);
  border-radius: 5px;
  color: #000;
  font-size: 12px;
  z-index: 1010;
  pre {
    font-family: var(--font-code);
  }
}
</style>
