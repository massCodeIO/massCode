import { store } from '../../store'
import fs from 'fs-extra'
import readline from 'readline'
import { nestedToFlat } from '../../utils'
import { nanoid } from 'nanoid'
import type { DB, Folder, Snippet, Tag } from '../../types/db'
import { oldLanguageMap } from '../../../renderer/components/editor/languages'

const fileDb = store.preferences.get('storagePath') + '/db.json'

const DEFAULT_SYSTEM_FOLDERS: Folder[] = [
  {
    id: nanoid(8),
    name: 'Inbox',
    defaultLanguage: 'plain_text',
    parentId: null,
    index: 0,
    isOpen: false,
    isSystem: true,
    createdAt: new Date().valueOf(),
    updatedAt: new Date().valueOf()
  }
]

const DEFAULT_FOLDER = {
  id: nanoid(8),
  name: 'Default',
  defaultLanguage: 'typescript',
  parentId: null,
  isOpen: false,
  isSystem: false,
  createdAt: new Date().valueOf(),
  updatedAt: new Date().valueOf()
}

export const createDb = () => {
  if (fs.existsSync(fileDb)) return

  const db = {
    folders: [...DEFAULT_SYSTEM_FOLDERS, DEFAULT_FOLDER],
    snippets: [],
    tags: []
  }

  writeToFile(db)

  store.app.delete('selectedFolderId')
  store.app.delete('selectedFolderIds')

  console.log('DB is created')
}

const writeToFile = (db: object) => {
  const data = JSON.stringify(db, null, 2)
  fs.writeFileSync(fileDb, data)
}

export const updateTable = (
  key: keyof DB,
  data: Folder[] | Snippet[] | Tag[],
  db: DB
) => {
  const clone = JSON.parse(JSON.stringify(db))
  clone[key] = data

  writeToFile(clone)
}

export const migrate = async (path: string) => {
  const files = await fs.readdir(path)
  const migrateFiles = ['masscode.db', 'snippets.db', 'tags.db']

  const isFilesExist = migrateFiles
    .reduce((acc: boolean[], item) => {
      acc.push(files.includes(item))
      return acc
    }, [])
    .every(i => i === true)

  if (!isFilesExist) throw Error('DB files not exist in this folder')

  const convertDBFileToJSON = async (fileName: string): Promise<any[]> => {
    const readInterface = readline.createInterface({
      input: fs.createReadStream(`${path}/${fileName}.db`),
      output: process.stdout
    })
    const arr: string[] = []

    return new Promise((resolve, reject) => {
      readInterface.on('line', line => {
        if (line) arr.push(JSON.parse(line))
      })

      readInterface.on('close', () => {
        resolve(arr)
      })
    })
  }

  const masscodeJSON = await convertDBFileToJSON('masscode')
  const masscodeJSONList = nestedToFlat(masscodeJSON[0].list)
  const snippetsJSON = await convertDBFileToJSON('snippets')
  const tagsJSON = await convertDBFileToJSON('tags')

  const folders: Folder[] = []
  const snippets: Snippet[] = []
  const tags: Tag[] = []

  const folderIdsMap: any[] = []
  const tagIdsMap: any[] = []

  folders.push(...DEFAULT_SYSTEM_FOLDERS)

  masscodeJSONList.forEach(
    ({ id, open, parentId, defaultLanguage, ...rest }) => {
      const newId = nanoid(8)

      folders.push({
        id: newId,
        isOpen: open,
        parentId: parentId ?? null,
        defaultLanguage: oldLanguageMap[defaultLanguage] || defaultLanguage,
        ...rest,
        createdAt: new Date().valueOf(),
        updatedAt: new Date().valueOf()
      })

      folderIdsMap.push([id, newId])
      folderIdsMap.forEach(([oldId, newId]) => {
        const item = folders.find(i => i.parentId === oldId)
        if (item) item.parentId = newId
      })
    }
  )

  tagsJSON.forEach(({ _id, ...rest }) => {
    const newId = nanoid(8)

    tags.push({
      id: newId,
      ...rest,
      createdAt: new Date().valueOf(),
      updatedAt: new Date().valueOf()
    })

    tagIdsMap.push([_id, newId])
  })

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  snippetsJSON.forEach(
    ({
      _id,
      folderId,
      folder,
      tags,
      tagsPopulated,
      createdAt,
      updatedAt,
      content,
      ...rest
    }) => {
      const newId = nanoid(8)
      const tagsIds: any[] = []
      const [, newFolderId] =
        folderIdsMap.find(i => i.includes(folderId)) || []

      tags.forEach((oldId: string) => {
        const [, newId] = tagIdsMap.find(i => i.includes(oldId)) || []
        if (newId) tagsIds.push(newId)
      })

      content = content.map((i: any) => {
        return {
          ...i,
          language: oldLanguageMap[i.language] || i.language
        }
      })

      snippets.push({
        id: newId,
        folderId: newFolderId ?? null,
        tagsIds,
        content,
        ...rest,
        createdAt: createdAt.$$date,
        updatedAt: updatedAt.$$date
      })
    }
  )

  const db = {
    folders,
    snippets,
    tags
  }
  writeToFile(db)
  console.log('Migrate is done')
}
