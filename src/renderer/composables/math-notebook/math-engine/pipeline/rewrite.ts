import type {
  AnalysisView,
  LineClassification,
  RewriteContext,
  RewritePhase,
  RewriteRule,
} from '../types'
import { finalizeRules } from '../rules/finalize'
import { normalizeRules } from '../rules/normalize'
import { semanticRewriteRules } from '../rules/semanticRewrite'
import { syntaxRewriteRules } from '../rules/syntaxRewrite'

const PHASE_ORDER: RewritePhase[] = [
  'normalize',
  'syntax-rewrite',
  'semantic-rewrite',
  'finalize',
]

const allRules: RewriteRule[] = [
  ...normalizeRules,
  ...syntaxRewriteRules,
  ...semanticRewriteRules,
  ...finalizeRules,
]

const rulesByPhase = new Map<RewritePhase, RewriteRule[]>()
for (const phase of PHASE_ORDER) {
  rulesByPhase.set(
    phase,
    allRules
      .filter(r => r.category === phase)
      .sort((a, b) => a.priority - b.priority),
  )
}

export function rewrite(
  view: AnalysisView,
  classification: LineClassification,
): string {
  const ctx: RewriteContext = {
    raw: view.raw,
    view,
    line: view.expression,
    classification,
  }

  for (const phase of PHASE_ORDER) {
    const rules = rulesByPhase.get(phase) || []
    for (const rule of rules) {
      const result = rule.apply(ctx)
      if (result) {
        ctx.line = result.line
      }
    }
  }

  return ctx.line
}
