import type { DonationsState, SpaceId } from '~/main/store/types'
import { store } from '@/electron'
import { format } from 'date-fns'

type CopySpace = SpaceId
type CreatedSpace = Exclude<SpaceId, 'tools'>
type SentSpace = Extract<SpaceId, 'http'>

const initial = store.app.get<DonationsState>('donations')

const state = reactive<DonationsState>(initial)

watch(
  state,
  () => {
    store.app.set('donations', JSON.parse(JSON.stringify(state)))
  },
  { deep: true },
)

function today() {
  return format(new Date(), 'yyyy-MM-dd')
}

function dayDiff(a: string, b: string) {
  const ms = new Date(b).getTime() - new Date(a).getTime()
  return Math.round(ms / (1000 * 60 * 60 * 24))
}

function incrementCopy(space: CopySpace) {
  state.copies[space] += 1
  markActiveDay()
}

function incrementCreated(space: CreatedSpace) {
  state.created[space] += 1
  markActiveDay()
}

function incrementSent(space: SentSpace) {
  state.sent[space] += 1
  markActiveDay()
}

function markActiveDay() {
  const now = today()

  if (state.lastActiveDay === now) {
    return
  }

  if (!state.lastActiveDay) {
    state.currentStreak = 1
  }
  else {
    const diff = dayDiff(state.lastActiveDay, now)
    state.currentStreak = diff === 1 ? state.currentStreak + 1 : 1
  }

  state.lastActiveDay = now
}

function markCopyMilestoneShown(space: CopySpace, milestone: number) {
  state.lastShownCopyMilestones[space] = milestone
}

function markCreatedMilestoneShown(space: CreatedSpace, milestone: number) {
  state.lastShownCreatedMilestones[space] = milestone
}

function markSentMilestoneShown(space: SentSpace, milestone: number) {
  state.lastShownSentMilestones[space] = milestone
}

function markStreakMilestoneShown(milestone: number) {
  if (!state.shownStreakMilestones.includes(milestone)) {
    state.shownStreakMilestones.push(milestone)
  }
}

function setGreetingDay(day: string) {
  state.lastGreetingDay = day
}

export function useDonations() {
  return {
    donations: state,
    today,
    incrementCopy,
    incrementCreated,
    incrementSent,
    markActiveDay,
    markCopyMilestoneShown,
    markCreatedMilestoneShown,
    markSentMilestoneShown,
    markStreakMilestoneShown,
    setGreetingDay,
  }
}
