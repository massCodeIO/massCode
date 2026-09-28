export function parseCookieFields(raw: string, domain: string) {
  const [pair, ...attributes] = raw.split(';')
  const separator = pair.indexOf('=')
  if (separator < 1)
    throw new Error('invalidCookie')
  const fields = {
    name: pair.slice(0, separator).trim(),
    value: pair.slice(separator + 1).trim(),
    domain,
    path: '/',
    expires: '',
    maxAge: '',
    secure: false,
    httpOnly: false,
    hostOnly: true,
    extra: [] as string[],
  }
  for (const attribute of attributes) {
    const index = attribute.indexOf('=')
    const key = (index < 0 ? attribute : attribute.slice(0, index))
      .trim()
      .toLowerCase()
    const value = index < 0 ? '' : attribute.slice(index + 1).trim()
    switch (key) {
      case 'domain':
        fields.domain = value
        fields.hostOnly = false
        break
      case 'path':
        fields.path = value
        break
      case 'expires':
        fields.expires = value
        break
      case 'max-age':
        fields.maxAge = value
        break
      case 'secure':
        fields.secure = true
        break
      case 'httponly':
        fields.httpOnly = true
        break
      default:
        if (attribute.trim())
          fields.extra.push(attribute.trim())
    }
  }
  return fields
}

export function serializeCookieFields(
  fields: ReturnType<typeof parseCookieFields>,
) {
  if (
    !fields.name.trim()
    || /[=;\s]/.test(fields.name)
    || /[;\r\n]/.test(fields.value)
    || !fields.domain.trim()
    || /[;\r\n]/.test(fields.domain)
    || !fields.path.startsWith('/')
    || /[;\r\n]/.test(fields.path)
    || (fields.maxAge && !/^-?\d+$/.test(fields.maxAge))
  ) {
    throw new Error('invalidCookie')
  }
  const parts = [`${fields.name}=${fields.value}`, `Path=${fields.path}`]
  if (!fields.hostOnly)
    parts.push(`Domain=${fields.domain}`)
  if (fields.expires) {
    const date = new Date(fields.expires)
    if (!Number.isFinite(date.getTime()))
      throw new Error('invalidExpires')
    parts.push(`Expires=${date.toUTCString()}`)
  }
  if (fields.maxAge)
    parts.push(`Max-Age=${fields.maxAge}`)
  if (fields.secure)
    parts.push('Secure')
  if (fields.httpOnly)
    parts.push('HttpOnly')
  return [...parts, ...fields.extra].join('; ')
}
