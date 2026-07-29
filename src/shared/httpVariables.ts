const HTTP_VARIABLE_PATTERN = /\{\{\s*([\w.-]+)\s*\}\}/g

/**
 * Чем подменяется значение secret-переменной везде, где запрос показывается
 * или сохраняется: превью в renderer и история запросов в vault.
 */
export const HTTP_SECRET_MASK = '••••••'

export function maskHttpSecretVariables(
  variables: Record<string, string>,
  secretKeys: string[],
): Record<string, string> {
  const masked = { ...variables }
  for (const key of secretKeys) {
    masked[key] = HTTP_SECRET_MASK
  }
  return masked
}

export function interpolateHttpVariables(
  template: string,
  variables: Record<string, string>,
): string {
  return template.replace(HTTP_VARIABLE_PATTERN, (match, key: string) => {
    return Object.prototype.hasOwnProperty.call(variables, key)
      ? variables[key]
      : match
  })
}
