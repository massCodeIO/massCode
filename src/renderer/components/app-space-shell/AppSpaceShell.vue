<template>
  <div class="grid h-screen grid-cols-[72px_1fr] overflow-hidden">
    <div class="bg-background border-border/70 mt-2 border-r">
      <SpaceRail />
    </div>
    <div class="min-h-0 min-w-0 overflow-hidden">
      <slot />
    </div>
  </div>
</template>
