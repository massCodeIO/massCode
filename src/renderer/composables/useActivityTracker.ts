import { useDonations } from '@/composables/useDonations'

let started = false

export function useActivityTracker() {
  if (started) {
    return
  }
  started = true

  const { markActiveDay } = useDonations()

  markActiveDay()
}
