import type { SpaceId } from '~/main/store/types'
import Donate from '@/components/ui/sonner/templates/Donate.vue'
import { useDonations } from '@/composables/useDonations'
import { i18n } from '@/electron'
import { toast } from 'vue-sonner'

type CopySpace = SpaceId
type CreatedSpace = Exclude<SpaceId, 'tools'>
type SentSpace = Extract<SpaceId, 'http'>

const COPY_INTERVAL = 25
const CREATED_INTERVAL = 25
const SENT_INTERVAL = 25
const COPY_SPACES: CopySpace[] = ['code', 'http', 'notes', 'math', 'tools']
const CREATED_SPACES: CreatedSpace[] = ['code', 'http', 'notes', 'math']
const SENT_SPACES: SentSpace[] = ['http']
const STREAK_MILESTONES = [7, 30, 100] as const

function getIntervalMilestone(total: number, interval: number): number | null {
  if (total < interval) {
    return null
  }
  return Math.floor(total / interval) * interval
}

function getStreakMilestone(streak: number): number | null {
  return STREAK_MILESTONES.find(m => m === streak) ?? null
}

const isToastVisible = ref(false)
let started = false

export function useDonationTriggers() {
  if (started) {
    return
  }
  started = true

  const {
    donations,
    today,
    markCopyMilestoneShown,
    markCreatedMilestoneShown,
    markSentMilestoneShown,
    markStreakMilestoneShown,
    setGreetingDay,
  } = useDonations()

  function showToast(title: string) {
    if (isToastVisible.value) {
      return
    }
    isToastVisible.value = true

    const todayKey = today()
    const variant = donations.lastGreetingDay === todayKey ? 'short' : 'full'
    if (variant === 'full') {
      setGreetingDay(todayKey)
    }

    toast.custom(markRaw(Donate), {
      componentProps: { title, variant },
      duration: Infinity,
      onDismiss: () => {
        isToastVisible.value = false
      },
    })
  }

  COPY_SPACES.forEach((space) => {
    watch(
      () => donations.copies[space],
      (count) => {
        const milestone = getIntervalMilestone(count, COPY_INTERVAL)
        if (
          milestone === null
          || milestone <= donations.lastShownCopyMilestones[space]
        ) {
          return
        }

        markCopyMilestoneShown(space, milestone)

        if (isToastVisible.value) {
          return
        }

        showToast(
          i18n.t(`messages:donations.trigger.copy.${space}`, {
            count: milestone,
          }),
        )
      },
    )
  })

  CREATED_SPACES.forEach((space) => {
    watch(
      () => donations.created[space],
      (count) => {
        const milestone = getIntervalMilestone(count, CREATED_INTERVAL)
        if (
          milestone === null
          || milestone <= donations.lastShownCreatedMilestones[space]
        ) {
          return
        }

        markCreatedMilestoneShown(space, milestone)

        if (isToastVisible.value) {
          return
        }

        showToast(
          i18n.t(`messages:donations.trigger.created.${space}`, {
            count: milestone,
          }),
        )
      },
    )
  })

  SENT_SPACES.forEach((space) => {
    watch(
      () => donations.sent[space],
      (count) => {
        const milestone = getIntervalMilestone(count, SENT_INTERVAL)
        if (
          milestone === null
          || milestone <= donations.lastShownSentMilestones[space]
        ) {
          return
        }

        markSentMilestoneShown(space, milestone)

        if (isToastVisible.value) {
          return
        }

        showToast(
          i18n.t(`messages:donations.trigger.sent.${space}`, {
            count: milestone,
          }),
        )
      },
    )
  })

  watch(
    () => donations.currentStreak,
    (streak) => {
      const milestone = getStreakMilestone(streak)
      if (
        milestone === null
        || donations.shownStreakMilestones.includes(milestone)
      ) {
        return
      }

      markStreakMilestoneShown(milestone)

      if (isToastVisible.value) {
        return
      }

      showToast(i18n.t(`messages:donations.trigger.streak_${milestone}.title`))
    },
  )
}
