import path from 'node:path'
import fs from 'fs-extra'
import yaml from 'js-yaml'

export function readYamlObjectFile<T>(filePath: string): T | null {
  if (!fs.pathExistsSync(filePath)) {
    return null
  }

  try {
    const source = fs.readFileSync(filePath, 'utf8')
    const parsed = yaml.load(source)

    if (!parsed || typeof parsed !== 'object') {
      return null
    }

    return parsed as T
  }
  catch {
    return null
  }
}

export function writeYamlObjectFile(
  filePath: string,
  data: Record<string, unknown>,
): void {
  const body = yaml
    .dump(data, {
      lineWidth: -1,
      noRefs: true,
      sortKeys: false,
    })
    .trim()

  fs.ensureDirSync(path.dirname(filePath))
  fs.writeFileSync(filePath, `${body}\n`, 'utf8')
}
