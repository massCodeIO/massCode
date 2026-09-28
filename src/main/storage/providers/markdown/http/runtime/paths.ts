import type { HttpPaths } from './types'
import path from 'node:path'
import { HTTP_SPACE_ID } from '../../runtime/constants'
import { getSpaceDirPath } from '../../runtime/spaces'
import { HTTP_STATE_FILE_NAME } from './constants'

export function getHttpPaths(vaultPath: string): HttpPaths {
  const httpRoot = getSpaceDirPath(vaultPath, HTTP_SPACE_ID)

  return {
    httpRoot,
    statePath: path.join(httpRoot, HTTP_STATE_FILE_NAME),
  }
}
