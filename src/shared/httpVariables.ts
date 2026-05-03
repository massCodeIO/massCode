const HTTP_VARIABLE_PATTERN = /\{\{\s*([\w.-]+)\s*\}\}/g

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
