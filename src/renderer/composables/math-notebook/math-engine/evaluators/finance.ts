import type { LineResult } from '../types'

interface FinanceResult {
  lineResult: LineResult
  rawResult: number
}

function formatCurrency(value: number, locale: string): string {
  return value.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function currencyResult(value: number, locale: string): FinanceResult {
  return {
    lineResult: {
      value: `$${formatCurrency(value, locale)}`,
      error: null,
      type: 'number',
      numericValue: value,
    },
    rawResult: value,
  }
}

function percentResult(value: number, locale: string): FinanceResult {
  const formatted = value.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return {
    lineResult: {
      value: `${formatted}%`,
      error: null,
      type: 'number',
      numericValue: value,
    },
    rawResult: value,
  }
}

function multiplierResult(value: number, locale: string): FinanceResult {
  const formatted = value.toLocaleString(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
  return {
    lineResult: {
      value: `${formatted}x`,
      error: null,
      type: 'number',
      numericValue: value,
    },
    rawResult: value,
  }
}

function parseAmount(text: string): number | null {
  const cleaned = text.replace(/[$,]/g, '').trim()
  const m = cleaned.match(/^(\d+(?:\.\d+)?)\s*([km]?)$/i)
  if (!m)
    return null
  let value = Number(m[1])
  const suffix = m[2].toLowerCase()
  if (suffix === 'k')
    value *= 1000
  if (suffix === 'm')
    value *= 1000000
  return value
}

function getCompoundingN(text: string): number {
  if (/compounding\s+monthly/i.test(text))
    return 12
  if (/compounding\s+quarterly/i.test(text))
    return 4
  if (/compounding\s+daily/i.test(text))
    return 365
  return 1 // yearly
}

export function evaluateFinanceLine(
  line: string,
  locale = 'en-US',
): FinanceResult | null {
  const lower = line.toLowerCase()

  // Compound interest: "$1,000 after/for 3 years at 7%"
  const compoundMatch = lower.match(
    /^\$[\d,.km]+\s+(?:after|for)\s+(\d+(?:\.\d+)?)\s+years?\s+(?:at|@)\s+(\d+(?:\.\d+)?)%/i,
  )
  if (compoundMatch) {
    const principal = parseAmount(line.match(/^\$[\d,.km]+/i)?.[0] || '')
    const years = Number(compoundMatch[1])
    const rate = Number(compoundMatch[2]) / 100
    const n = getCompoundingN(lower)
    if (principal !== null) {
      const total = principal * (1 + rate / n) ** (n * years)
      return currencyResult(total, locale)
    }
  }

  // Interest only: "interest on $1,000 after/for 3 years at 7%"
  const interestOnMatch = lower.match(
    /^interest\s+on\s+\$[\d,.km]+\s+(?:after|for)\s+(\d+(?:\.\d+)?)\s+years?\s+(?:at|@)\s+(\d+(?:\.\d+)?)%/i,
  )
  if (interestOnMatch) {
    const principal = parseAmount(line.match(/\$[\d,.km]+/i)?.[0] || '')
    const years = Number(interestOnMatch[1])
    const rate = Number(interestOnMatch[2]) / 100
    const n = getCompoundingN(lower)
    if (principal !== null) {
      const total = principal * (1 + rate / n) ** (n * years)
      return currencyResult(total - principal, locale)
    }
  }

  // Simple ROI: "$500 invested $1,500 returned"
  const roiMatch = lower.match(
    /^\$[\d,.km]+\s+invested\s+\$[\d,.km]+\s+returned$/i,
  )
  if (roiMatch) {
    const amounts = line.match(/\$[\d,.km]+/gi)
    if (amounts && amounts.length === 2) {
      const invested = parseAmount(amounts[0])
      const returned = parseAmount(amounts[1])
      if (invested !== null && returned !== null && invested > 0) {
        return multiplierResult(returned / invested, locale)
      }
    }
  }

  // Annual return: "annual return on $1,000 invested $2,500 returned after 7 years"
  const annualReturnMatch = lower.match(
    /^annual\s+return\s+on\s+\$[\d,.km]+\s+invested\s+\$[\d,.km]+\s+returned\s+after\s+(\d+(?:\.\d+)?)\s+years?$/i,
  )
  if (annualReturnMatch) {
    const amounts = line.match(/\$[\d,.km]+/gi)
    const years = Number(annualReturnMatch[1])
    if (amounts && amounts.length === 2 && years > 0) {
      const invested = parseAmount(amounts[0])
      const returned = parseAmount(amounts[1])
      if (invested !== null && returned !== null && invested > 0) {
        const annualReturn = ((returned / invested) ** (1 / years) - 1) * 100
        return percentResult(annualReturn, locale)
      }
    }
  }

  // Present value: "present value of $1,000 after 20 years at 10%"
  const pvMatch = lower.match(
    /^present\s+value\s+of\s+\$[\d,.km]+\s+after\s+(\d+(?:\.\d+)?)\s+years?\s+(?:at|@)\s+(\d+(?:\.\d+)?)%/i,
  )
  if (pvMatch) {
    const fv = parseAmount(line.match(/\$[\d,.km]+/i)?.[0] || '')
    const years = Number(pvMatch[1])
    const rate = Number(pvMatch[2]) / 100
    if (fv !== null) {
      return currencyResult(fv / (1 + rate) ** years, locale)
    }
  }

  // Mortgage/Loan repayment: "monthly repayment on $10,000 over 6 years at 6%"
  const repaymentMatch = lower.match(
    /^(daily|monthly|annual|total)\s+(repayment|interest)\s+on\s+\$[\d,.km]+\s+over\s+(\d+(?:\.\d+)?)\s+years?\s+(?:at|@)\s+(\d+(?:\.\d+)?)%/i,
  )
  if (repaymentMatch) {
    const period = repaymentMatch[1]
    const type = repaymentMatch[2]
    const principal = parseAmount(line.match(/\$[\d,.km]+/i)?.[0] || '')
    const years = Number(repaymentMatch[3])
    const annualRate = Number(repaymentMatch[4]) / 100

    if (principal !== null && years > 0) {
      const monthlyRate = annualRate / 12
      const totalMonths = years * 12

      if (type === 'repayment') {
        const monthlyPayment
          = monthlyRate > 0
            ? (principal * (monthlyRate * (1 + monthlyRate) ** totalMonths))
            / ((1 + monthlyRate) ** totalMonths - 1)
            : principal / totalMonths

        switch (period) {
          case 'monthly':
            return currencyResult(monthlyPayment, locale)
          case 'daily':
            return currencyResult((monthlyPayment * 12) / 365, locale)
          case 'annual':
            return currencyResult(monthlyPayment * 12, locale)
          case 'total':
            return currencyResult(monthlyPayment * totalMonths, locale)
        }
      }
      else {
        const monthlyPayment
          = monthlyRate > 0
            ? (principal * (monthlyRate * (1 + monthlyRate) ** totalMonths))
            / ((1 + monthlyRate) ** totalMonths - 1)
            : principal / totalMonths

        const totalInterest = monthlyPayment * totalMonths - principal
        switch (period) {
          case 'total':
            return currencyResult(totalInterest, locale)
          case 'annual':
            return currencyResult(totalInterest / years, locale)
          case 'monthly':
            return currencyResult(totalInterest / totalMonths, locale)
          case 'daily':
            return currencyResult(totalInterest / (years * 365), locale)
        }
      }
    }
  }

  return null
}
