<script setup lang="ts">
import { useApp, useTheme } from '@/composables'
import { i18n, ipc } from '@/electron'
import Typed from 'typed.js'

const { isSponsored } = useApp()
const { isDark } = useTheme()

const labelRef = ref<HTMLElement | null>(null)
let typed: Typed | null = null

const TYPING_DELAY = 1000 * 15
const FIRST_PROMPT = i18n.t('messages:special.unsponsored').toUpperCase()

const SINCE_YEAR = 2019
const NOW_YEAR = new Date().getFullYear()

const prompts = [
  'Zero sponsors. Infinite snippets',
  'Free. Forever. Fueled by you',
  'No sponsors. No regrets',
  'Open source. Open wallet? 👀',
  `${NOW_YEAR - SINCE_YEAR} years solo. Still going`,
  'Ad-free since 2019',
  '404: Sponsor Not Found',
  'One dev. Thousands of users. Math? 🤔',
  'Your snippets. My rent',
  'Love it? Fuel it',
  'You use it. You fund it?',
  'A coffee keeps v6 coming',
  'Stars are nice. Coffee is better',
  'Built with love. Funded by you?',
  'No tracking. No ads. No catch',
  'Indie. Forever',
  'Side project, full heart',
  'Made by humans, for humans',
  'Vibes-driven development',
  '100% indie. 0% bullshit',
  'Snippets > Sponsors',
  // дев прикол
  '$ donate --please',
  'throw new Error("No sponsors yet")',
  'sudo support-massCode',
  'npm install coffee',
  'git blame → one guy',
  'sponsors.length === 0',
  '// TODO: find sponsor',
  'kill -9 ads',
  'if (you.likeIt) donate()',
  'await getSponsor() // pending...',
  'try { ship() } catch { coffee() }',
  'SELECT * FROM sponsors → 0 rows',
  'console.log("send help")',
  'npm install --save-life',
  'git push --love origin main',
  'chmod +x developer',
  'function fund() { return ❤️ }',
  'rm -rf ads/',
  'process.exit(0) // jk, still here',
  'import coffee from "you"',
  'Error: SponsorsNotFoundException',
  'cargo run --keep-alive',
  'docker run --restart=donations',
  // самоирония
  'Stars don\'t pay rent',
  'GitHub stars: many. Sponsors: zero',
  'One-man army. Tired army',
  'Built different. Funded different?',
  'Ship it. Eat ramen. Repeat',
  'Free for you. Costly for me',
]

function shufflePrompts(input: string[]) {
  const shuffled = [...input]

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const current = shuffled[i]
    shuffled[i] = shuffled[j]
    shuffled[j] = current
  }

  return shuffled
}

function getPromptSequence() {
  return [FIRST_PROMPT, ...shufflePrompts(prompts)]
}

function openDonatePage() {
  void ipc.invoke(
    'system:open-external',
    'https://masscode.io/donate/?ref=unsponsored-label',
  )
}

onMounted(() => {
  if (isSponsored || !labelRef.value) {
    return
  }

  typed = new Typed(labelRef.value, {
    strings: getPromptSequence(),
    typeSpeed: 60,
    backSpeed: 20,
    backDelay: TYPING_DELAY,
    startDelay: 700,
    loop: true,
    smartBackspace: true,
    showCursor: false,
  })
})

onBeforeUnmount(() => {
  typed?.destroy()
  typed = null
})
</script>

<template>
  <button
    v-if="!isSponsored"
    type="button"
    class="relative h-32 w-3 cursor-pointer border-0 bg-transparent p-0 focus-visible:outline-none"
    :class="isDark ? 'text-amber-300/70' : 'text-violet-500/70'"
    @click="openDonatePage"
  >
    <div
      class="absolute top-0 left-0 flex h-3 w-32 origin-top-left translate-y-32 -rotate-90 items-center"
    >
      <span
        ref="labelRef"
        class="_uppercase font-mono text-[10px] leading-none font-semibold tracking-[0.14em] whitespace-nowrap select-none"
      />
    </div>
  </button>
</template>
