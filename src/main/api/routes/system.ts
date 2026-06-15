import { Elysia } from 'elysia'
import { resetRuntimeCache } from '../../storage/providers/markdown'
import {
  applyVaultDoctor,
  previewVaultDoctor,
} from '../../storage/providers/markdown/doctor'
import { getVaultPath } from '../../storage/providers/markdown/runtime'
import { vaultDoctorDTO } from '../dto/vault-doctor'

const app = new Elysia({ prefix: '/system' }).use(vaultDoctorDTO)

app.get(
  '/storage-vault-path',
  () => {
    return {
      vaultPath: getVaultPath(),
    }
  },
  {
    detail: {
      tags: ['System'],
    },
  },
)

app.post(
  '/storage-cache/reset',
  () => {
    resetRuntimeCache()

    return {
      reset: true,
    }
  },
  {
    detail: {
      tags: ['System'],
    },
  },
)

app.post(
  '/vault-doctor/preview',
  ({ body }) => {
    return previewVaultDoctor(body)
  },
  {
    body: 'vaultDoctorInput',
    response: 'vaultDoctorResponse',
    detail: {
      tags: ['System'],
    },
  },
)

app.post(
  '/vault-doctor/apply',
  ({ body }) => {
    return applyVaultDoctor(body)
  },
  {
    body: 'vaultDoctorInput',
    response: 'vaultDoctorResponse',
    detail: {
      tags: ['System'],
    },
  },
)

export default app
