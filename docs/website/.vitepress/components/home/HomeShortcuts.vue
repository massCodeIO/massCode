<script setup lang="ts">
import { ArrowUp, Command, RotateCcw } from 'lucide-vue-next'
import { onMounted, onUnmounted, ref } from 'vue'

const windows = ref(false)
const playing = ref(false)
const stage = ref<HTMLElement>()
let observer: IntersectionObserver | undefined

function replay() {
  playing.value = false
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      playing.value = true
    }),
  )
}
onMounted(() => {
  observer = new IntersectionObserver(
    ([entry]) => {
      playing.value = entry.isIntersecting
    },
    { threshold: 0.5 },
  )
  if (stage.value)
    observer.observe(stage.value)
})
onUnmounted(() => observer?.disconnect())
</script>

<template>
  <div
    ref="stage"
    class="shortcut-stage"
    :class="{ playing }"
  >
    <div
      class="platforms"
      aria-label="Shortcut platform"
    >
      <button
        :aria-pressed="!windows"
        @click="
          windows = false;
          replay();
        "
      >
        macOS
      </button>
      <button
        :aria-pressed="windows"
        @click="
          windows = true;
          replay();
        "
      >
        Windows / Linux
      </button>
      <button
        class="replay"
        aria-label="Replay shortcut animation"
        @click="replay"
      >
        <RotateCcw
          :size="15"
          aria-hidden="true"
        />
      </button>
    </div>
    <div
      class="key-scene"
      role="img"
      :aria-label="
        windows
          ? 'Control P to search. Control Shift P to run commands.'
          : 'Command P to search. Command Shift P to run commands.'
      "
    >
      <div
        class="key-row"
        aria-hidden="true"
      >
        <kbd class="key modifier"><Command
          v-if="!windows"
          :size="22"
        /><span
          v-else
          class="ctrl-symbol"
        >ctrl</span><span>{{ windows ? "control" : "command" }}</span></kbd>
        <span class="plus">+</span>
        <div class="shift-slot">
          <kbd class="key shift"><ArrowUp :size="22" /><span>shift</span></kbd><span class="plus">+</span>
        </div>
        <kbd class="key letter">P</kbd>
      </div>
      <div
        class="action-label"
        aria-hidden="true"
      >
        <span class="search-label">Find your work.</span><span class="command-label">Run a command.</span>
      </div>
    </div>
    <p>
      {{
        windows
          ? "Ctrl P to search · Ctrl Shift P for commands"
          : "⌘ P to search · ⌘ ⇧ P for commands"
      }}
    </p>
  </div>
</template>

<style scoped>
.shortcut-stage {
  margin-top: 28px;
  max-width: 470px;
  padding: 16px 20px 20px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 14px;
  background: var(--vp-c-bg-soft);
}
.platforms {
  display: flex;
  align-items: center;
  gap: 14px;
}
.platforms button {
  min-height: 36px;
  color: var(--home-muted);
  font-size: 11px;
  cursor: pointer;
}
.platforms button[aria-pressed="true"] {
  color: var(--home-text);
}
.platforms .replay {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  margin-left: auto;
}
button:focus-visible {
  outline: 2px solid var(--home-highlight);
  outline-offset: 3px;
  border-radius: 4px;
}
.key-scene {
  padding: 22px 0 0;
}
.key-row {
  --key-gap: 10px;
  --shift-width: 96px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  height: 90px;
}
.key {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  width: 94px;
  height: 78px;
  padding: 11px;
  border: 1px solid color-mix(in srgb, var(--home-text) 14%, transparent);
  border-radius: 9px;
  background: linear-gradient(145deg, var(--vp-c-bg), var(--vp-c-bg-soft));
  color: var(--home-text);
  box-shadow:
    0 5px 0 color-mix(in srgb, var(--vp-c-bg) 80%, #000),
    0 8px 12px #00000018,
    inset 0 1px 0 #ffffff20;
  font-family: inherit;
}
.key svg,
.ctrl-symbol {
  align-self: flex-end;
}
.key > span:last-child {
  font-size: 12px;
}
.key.letter {
  width: 76px;
  align-items: center;
  justify-content: center;
  font-size: 26px;
  font-weight: 500;
}
.plus {
  color: var(--home-muted);
  font-size: 13px;
}
.shift-slot {
  display: none;
  flex: 0 0 auto;
  align-items: center;
  gap: var(--key-gap);
}
.shift-slot .key {
  flex-shrink: 0;
}
.shift-slot .plus {
  flex: 0 0 8px;
}
.shift {
  width: 78px;
}
.action-label {
  position: relative;
  margin-top: 26px;
  height: 24px;
  text-align: center;
  font-size: 14px;
  color: var(--home-text);
}
.command-label {
  display: none;
}
p {
  margin-top: 12px;
  text-align: center;
  color: var(--home-muted);
  font-size: 11px;
  line-height: 1.6;
}
.playing .key {
  animation: key-press 4.8s cubic-bezier(0.16, 1, 0.3, 1) both;
}
.playing .letter {
  animation-delay: 100ms;
}
.playing .shift-slot {
  display: flex;
  animation: shift-reveal 4.8s cubic-bezier(0.16, 1, 0.3, 1) both;
}
.playing .search-label {
  animation: search-label 4.8s step-end both;
}
.playing .command-label {
  display: block;
  position: absolute;
  inset: 0;
  animation: command-label 4.8s step-end both;
}
@keyframes key-press {
  0%,
  18%,
  44%,
  66%,
  100% {
    transform: translateY(0);
  }
  8%,
  55% {
    transform: translateY(4px);
    box-shadow:
      0 1px 0 color-mix(in srgb, var(--vp-c-bg) 80%, #000),
      0 2px 4px #00000018,
      inset 0 1px 0 #ffffff12;
  }
}
@keyframes shift-reveal {
  0%,
  28% {
    width: 0;
    margin-left: calc(-1 * var(--key-gap));
    opacity: 0;
    transform: translateY(10px) scale(0.94);
  }
  40%,
  100% {
    width: var(--shift-width);
    margin-left: 0;
    opacity: 1;
    transform: none;
  }
}
@keyframes search-label {
  0% {
    opacity: 1;
  }
  35%,
  100% {
    opacity: 0;
  }
}
@keyframes command-label {
  0% {
    opacity: 0;
  }
  35%,
  100% {
    opacity: 1;
  }
}
@media (max-width: 640px) {
  .shortcut-stage {
    padding-inline: 12px;
  }
  .key-row {
    --key-gap: 7px;
    --shift-width: 79px;
  }
  .key-row,
  .shift-slot {
    gap: 7px;
  }
  .key {
    width: 80px;
  }
  .shift {
    width: 64px;
  }
  .key.letter {
    width: 60px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .playing .key,
  .playing .shift-slot,
  .playing .search-label,
  .playing .command-label {
    animation: none;
  }
  .playing .shift-slot,
  .playing .command-label {
    display: none;
  }
}
</style>
