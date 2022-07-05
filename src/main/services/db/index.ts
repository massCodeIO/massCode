import { store } from '../../store'
import fs from 'fs-extra'
import readline from 'readline'
import { nestedToFlat } from '../../utils'
import { nanoid } from 'nanoid'
import type {
  DB,
  Folder,
  Snippet,
  SnippetContent,
  Tag
} from '@shared/types/main/db'
import {
  oldLanguageMap,
  languages
} from '../../../renderer/components/editor/languages'
import { snakeCase } from 'lodash'
import type { LanguageOption, Language } from '@shared/types/renderer/editor'

const DB_NAME = 'db.json'

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

const getFileDb = () => {
  return store.preferences.get('storagePath') + `/${DB_NAME}`
}

export const createDb = () => {
  const fileDb = getFileDb()

  if (fs.existsSync(fileDb)) {
    return
  } else {
    fs.ensureFileSync(fileDb)
  }

  const db = {
    folders: [DEFAULT_FOLDER],
    snippets: [],
    tags: []
  }

  writeToFile(db)

  store.app.delete('selectedFolderId')
  store.app.delete('selectedFolderIds')

  console.log('DB is created')
}

const writeToFile = (db: object) => {
  const fileDb = getFileDb()
  const data = JSON.stringify(db, null, 2)
  fs.writeFileSync(fileDb, data)
}

export const move = async (from: string, to: string) => {
  const src = `${from}/${DB_NAME}`
  const dist = `${to}/${DB_NAME}`

  if (isDbExist(to)) {
    throw Error(
      'Folder already contains db file. Please select another folder.'
    )
  }
  await fs.move(src, dist)
}

export const isDbExist = (path: string) => {
  const files = fs.readdirSync(path)
  return files.some(i => i === DB_NAME)
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
          value: i.value || '',
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

export const migrateFromSnippetsLab = (path: string) => {
  const file = fs.readFileSync(path, 'utf-8')
  const json = JSON.parse(file)

  // с версии 2.1
  if (json.app !== undefined) {
    migrateFromSnippetsLabNew(path)
  } else {
    migrateFromSnippetsLabOld(path)
  }
}

// Мигратор до версии 2.1
export const migrateFromSnippetsLabOld = (path: string) => {
  interface SLFragment {
    Content: string
    'Date Created': string
    'Date Modified': string
    Note: string
    Title: string
    Language: string
  }
  interface SLSnippet {
    'Date Created': string
    'Date Modified': string
    Folder: string
    Title: string
    Fragments: SLFragment[]
    Tags: string[]
  }

  interface SnippetsLabDbJSON {
    Snippets: SLSnippet[]
  }

  const INBOX = 'Uncategorized'

  const file = fs.readFileSync(path, 'utf-8')
  const json = JSON.parse(file) as SnippetsLabDbJSON

  const folders = new Set<string>()
  const tags = new Set<string>()

  const db: DB = {
    folders: [],
    snippets: [],
    tags: []
  }

  json.Snippets.forEach(i => {
    if (i.Folder) folders.add(i.Folder)

    if (i.Tags.length) {
      i.Tags.forEach(t => tags.add(t))
    }
  })

  folders.forEach(i => {
    if (i === INBOX) return
    db.folders.push({
      id: nanoid(8),
      name: i,
      defaultLanguage: 'plain_text',
      parentId: null,
      isOpen: false,
      isSystem: false,
      createdAt: new Date().valueOf(),
      updatedAt: new Date().valueOf()
    })
  })

  tags.forEach(i => {
    db.tags.push({
      id: nanoid(8),
      name: i,
      createdAt: new Date().valueOf(),
      updatedAt: new Date().valueOf()
    })
  })

  json.Snippets.forEach(i => {
    const folderId = db.folders.find(f => f.name === i.Folder)?.id || ''
    const tagsIds: string[] = []

    if (i.Tags.length) {
      i.Tags.forEach(t => {
        const id = db.tags.find(_t => _t.name === t)?.id
        if (id) tagsIds.push(id)
      })
    }

    const snippet: Snippet = {
      id: nanoid(8),
      name: i.Title,
      content: [],
      folderId,
      tagsIds,
      isDeleted: false,
      isFavorites: false,
      createdAt: new Date(i['Date Created']).valueOf(),
      updatedAt: new Date(i['Date Modified']).valueOf()
    }

    if (i.Fragments.length) {
      i.Fragments.forEach(f => {
        snippet.content.push({
          label: f.Title,
          value: f.Content,
          language: convertSLLanguage(f.Language, languages, 'old')
        })
      })
    }

    db.snippets.push(snippet)
  })

  writeToFile(db)
  console.log('Migrate is done')
}

// Мигратор с версии 2.1
export const migrateFromSnippetsLabNew = (path: string) => {
  interface SLFragment {
    content: string
    dateCreated: string
    dateModified: string
    language: string
    note: string
    title: string
    uuid: string
  }
  interface SLSnippet {
    dateCreated: string
    dateModified: string
    folder: string
    fragments: SLFragment[]
    title: string
    uuid: string
    tags: string[]
  }
  interface SLFolder {
    title: string
    defaultLanguages: string
    uuid: string
    children: SLFolder[]
  }
  interface SLTag {
    title: string
    uuid: string
  }

  interface SnippetsLabDbJSON {
    contents: {
      snippets: SLSnippet[]
      tags: SLTag[]
      folders: SLFolder[]
    }
  }

  const file = fs.readFileSync(path, 'utf-8')
  const json = JSON.parse(file) as SnippetsLabDbJSON

  const db: DB = {
    folders: [],
    snippets: [],
    tags: []
  }

  const createFolders = (folders: SLFolder[]) => {
    const createFolder = (folder: SLFolder, parentId: string | null = null) => {
      const _folder: Folder = {
        id: folder.uuid,
        name: folder.title,
        createdAt: new Date().valueOf(),
        updatedAt: new Date().valueOf(),
        isOpen: false,
        isSystem: false,
        defaultLanguage: 'plain_text',
        parentId
      }

      db.folders.push(_folder)

      return _folder.id
    }

    const createFoldersFromChildren = (cf: SLFolder[], parenId: string) => {
      if (!cf) return

      cf.forEach(c => {
        const id = createFolder(c, parenId)

        if (c.children && c.children.length) {
          createFoldersFromChildren(c.children, id)
        }
      })
    }

    folders.forEach(f => {
      const id = createFolder(f)
      createFoldersFromChildren(f.children, id)
    })
  }

  createFolders(json.contents.folders)

  json.contents.tags.forEach(t => {
    db.tags.push({
      id: t.uuid,
      name: t.title,
      createdAt: new Date().valueOf(),
      updatedAt: new Date().valueOf()
    })
  })

  json.contents.snippets.forEach(s => {
    const createContent = (fragments: SLFragment[]) => {
      return fragments.map<SnippetContent>(f => {
        return {
          label: f.title,
          value: f.content,
          language: convertSLLanguage(f.language, languages)
        }
      })
    }

    db.snippets.push({
      id: s.uuid,
      name: s.title,
      createdAt: new Date(s.dateCreated).valueOf(),
      updatedAt: new Date(s.dateModified).valueOf(),
      folderId: s.folder ?? null,
      isDeleted: false,
      isFavorites: false,
      content: createContent(s.fragments),
      tagsIds: s.tags || []
    })
  })

  writeToFile(db)
  console.log('Migrate is done')
}

const convertSLLanguage = (
  language: string,
  languages: LanguageOption[],
  version: 'new' | 'old' = 'new'
): Language => {
  if (version === 'new') {
    language = language.replace(/Lexer$/, '')
  }

  const _language = snakeCase(language.toLowerCase())
  return languages.find(i => i.value === _language)?.value || 'plain_text'
}
