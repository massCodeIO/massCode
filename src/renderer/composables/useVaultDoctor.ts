import type { VaultDoctorResponse } from '~/renderer/services/api/generated'
import { api } from '~/renderer/services/api'

type ConflictGroup = VaultDoctorResponse['conflictGroups'][number]

// Эвристика конфликтных копий cloud-sync: Dropbox "(conflicted copy)",
// Яндекс.Диск / macOS "— копия", generic "copy". Используется только для
// визуальной подсказки и предвыбора canonical, не влияет на backend.
const COPY_RE = /(?:—|-)\s*копия|\bкопия\b|\bcopy\b|conflict/i

// Module-level shared state: один отчёт переиспользуется между startup-проверкой
// (App.vue) и секцией Vault Doctor (Storage.vue), чтобы не сканировать дважды.
const report = shallowRef<VaultDoctorResponse | null>(null)
const decisionByGroupId = reactive<Record<string, string>>({})
const isScanning = ref(false)
const isApplying = ref(false)

function splitPath(value: string): { dir: string, name: string } {
  const index = value.lastIndexOf('/')
  if (index === -1) {
    return { dir: '', name: value }
  }

  return { dir: value.slice(0, index + 1), name: value.slice(index + 1) }
}

function isCopyPath(path: string): boolean {
  return COPY_RE.test(splitPath(path).name)
}

// Рекомендуемый canonical: первый файл без признаков копии, иначе самый
// короткий по имени (вероятный оригинал), иначе первый в группе.
function getCanonicalPath(group: ConflictGroup): string {
  const original = group.items.find(item => !isCopyPath(item.path))
  if (original) {
    return original.path
  }

  return (
    [...group.items].sort(
      (a, b) => splitPath(a.path).name.length - splitPath(b.path).name.length,
    )[0]?.path ?? group.items[0]?.path
  )
}

function resetDecisions() {
  Object.keys(decisionByGroupId).forEach((groupId) => {
    delete decisionByGroupId[groupId]
  })
}

function preselectDecisions(value: VaultDoctorResponse) {
  value.conflictGroups
    .filter(group => group.reason === 'duplicate-id')
    .forEach((group) => {
      decisionByGroupId[group.id] = getCanonicalPath(group)
    })
}

export function useVaultDoctor() {
  const hasReport = computed(() => !!report.value)

  const safeFixesCount = computed(
    () =>
      report.value?.items.filter(item => item.status === 'pending').length
      ?? 0,
  )

  const blockedCount = computed(() => report.value?.summary.blocked ?? 0)

  const conflictCount = computed(() => report.value?.summary.conflicts ?? 0)

  const duplicateGroups = computed(
    () =>
      report.value?.conflictGroups.filter(
        group => group.reason === 'duplicate-id',
      ) ?? [],
  )

  const selectedDecisionCount = computed(
    () =>
      duplicateGroups.value.filter(group => !!decisionByGroupId[group.id])
        .length,
  )

  const warningPreview = computed(
    () => report.value?.warnings.slice(0, 5) ?? [],
  )

  const hiddenWarningCount = computed(() => {
    const total = report.value?.warnings.length ?? 0
    return Math.max(0, total - warningPreview.value.length)
  })

  const canApply = computed(
    () => safeFixesCount.value > 0 || selectedDecisionCount.value > 0,
  )

  function selectDecision(groupId: string, keepPath: string) {
    decisionByGroupId[groupId] = keepPath
  }

  function isDecisionSelected(groupId: string, path: string): boolean {
    return decisionByGroupId[groupId] === path
  }

  function getDecisionReassignCount(group: ConflictGroup): number {
    return decisionByGroupId[group.id] ? group.items.length - 1 : 0
  }

  function getConflictId(group: ConflictGroup): string {
    return group.id.split(':').at(-1) ?? group.id
  }

  // Возвращает отчёт. Ошибки пробрасываются — вызывающий решает, как их
  // показать (тихо на startup, через sonner в настройках).
  async function scan(): Promise<VaultDoctorResponse | null> {
    if (isScanning.value || isApplying.value) {
      return report.value
    }

    isScanning.value = true

    try {
      const { data } = await api.system.postSystemVaultDoctorPreview({})
      resetDecisions()
      preselectDecisions(data)
      report.value = data
      return data
    }
    finally {
      isScanning.value = false
    }
  }

  // Сбрасывает отчёт и решения. Нужно при смене vault: старый отчёт относится
  // к прежнему пути и к новому vault неприменим.
  function reset() {
    report.value = null
    resetDecisions()
  }

  async function apply(): Promise<VaultDoctorResponse> {
    isApplying.value = true

    try {
      const decisions = Object.entries(decisionByGroupId).map(
        ([groupId, keepPath]) => ({ groupId, keepPath }),
      )
      const { data } = await api.system.postSystemVaultDoctorApply({
        decisions,
      })
      resetDecisions()
      report.value = data
      return data
    }
    finally {
      isApplying.value = false
    }
  }

  return {
    report,
    decisionByGroupId,
    isScanning,
    isApplying,
    hasReport,
    safeFixesCount,
    blockedCount,
    conflictCount,
    duplicateGroups,
    selectedDecisionCount,
    warningPreview,
    hiddenWarningCount,
    canApply,
    splitPath,
    isCopyPath,
    getConflictId,
    getDecisionReassignCount,
    selectDecision,
    isDecisionSelected,
    scan,
    apply,
    reset,
  }
}
