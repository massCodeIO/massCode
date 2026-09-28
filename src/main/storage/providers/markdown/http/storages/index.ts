import type { HttpStorageProvider } from '../../../../contracts'
import { createHttpEnvironmentsStorage } from './environments'
import { createHttpFoldersStorage } from './folders'
import { createHttpHistoryStorage } from './history'
import { createHttpRequestsStorage } from './requests'

export function createHttpStorageProvider(): HttpStorageProvider {
  return {
    environments: createHttpEnvironmentsStorage(),
    folders: createHttpFoldersStorage(),
    history: createHttpHistoryStorage(),
    requests: createHttpRequestsStorage(),
  }
}
