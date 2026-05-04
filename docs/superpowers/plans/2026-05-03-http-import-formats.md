# HTTP space — импорт коллекций из внешних клиентов

## Цель

Дать пользователям перенести коллекции запросов из существующих HTTP-клиентов и API specifications (OpenAPI, Postman, Bruno и т.д.) в HTTP space massCode. Без необходимости пересоздавать запросы вручную.

Связано с планом [`2026-04-30-http-space.md`](./2026-04-30-http-space.md) — этот документ описывает только импорт.

## Стратегия

Внутренний единый IR (intermediate representation) для коллекции/папки/запроса/окружения. Каждый импортер — чистая функция `(rawFile | string) → IR`, без доступа к файловой системе, vault и Electron API.

Текущий v1 scope: OpenAPI JSON/YAML, Postman Collection v2.1 JSON + optional Postman Environment JSON, Bruno OpenCollection YAML/ZIP.

Сохранение результата — отдельный main/API orchestration слой поверх существующего HTTP storage provider. Import flow создаёт папки, запросы и окружения через текущие storage/API методы HTTP space; прямой записи `.md`, `.state.yaml` или runtime cache из импортера быть не должно.

Преимущества:

- Изоляция парсеров — добавление формата не трогает основное приложение
- Один путь записи через HTTP storage → одна точка валидации/нормализации, counters, `.state.yaml` и watcher остаются согласованными
- Тестируемость — каждый импортер тестируется по golden fixtures без файловой системы

### IR (черновик)

```ts
type ImportResult = {
  collections: ImportCollection[]
  environments: ImportEnvironment[]
  warnings: ImportWarning[]   // про потерянные фичи (scripts, oauth2 flows и т.п.)
}

type ImportWarning = {
  source: string        // file/collection/request path, например "postman.json/Auth/Login"
  message: string
}

type ImportPersistSummary = {
  collections: number
  folders: number
  requests: number
  environments: number
  createdCollectionNames: string[]
  warnings: ImportWarning[]
}

type ImportCollection = {
  name: string
  description?: string
  // При сохранении collection всегда становится top-level folder в http/.
  // Root-level requests с folderId: null создаются внутри этой папки.
  folders: ImportFolder[]   // плоский список, иерархия через parentId
  requests: ImportRequest[]
}

type ImportFolder = { id: string, parentId: string | null, name: string }

type ImportRequest = {
  sourceId?: string                    // id из внешнего клиента для debug/warnings; не сохраняется в HTTP request
  folderId: string | null
  name: string
  method: HttpMethod
  url: string                       // с {{var}} как есть
  headers: Array<{ key: string, value: string, enabled?: boolean }>
  query: Array<{ key: string, value: string, enabled?: boolean }>
  bodyType: 'none' | 'json' | 'text' | 'form-urlencoded' | 'multipart'
  body: string | null
  formData: Array<{ key: string, type: 'text' | 'file', value: string }>
  auth: ImportAuth
  description?: string
}

type ImportAuth =
  | { type: 'none' }
  | { type: 'bearer', token: string }
  | { type: 'basic', username: string, password: string }
  // остальное → warning + сохранить как header при возможности

type ImportEnvironment = {
  name: string
  // Текущая модель HTTP space хранит variables как Record<string, string>.
  // Disabled variables из внешних клиентов не импортируются и добавляются в warnings.
  variables: Record<string, string>
}
```

### Нормализация IR

- `url` и `query` не должны дублировать друг друга. Если importer извлекает query params в `query[]`, он сохраняет `url` без query string. Если формат даёт только raw URL, parser разбирает query string в `query[]`, а base URL оставляет в `url`.
- URL fragments (`#...`) не сохраняются в HTTP request, потому что они не отправляются на сервер; добавлять warning не нужно.
- Поддерживаемые методы ограничены текущим `HttpMethod`: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`. Requests с `TRACE`, `CONNECT` или custom methods не импортируются и попадают в warnings; не приводить их к `GET`.
- Если request содержит explicit `Authorization` header и auth config одновременно, explicit header сохраняется, а `auth` ставится `{ type: 'none' }` с warning. Это предотвращает двойной Authorization при execute.
- Unsupported auth не должен silently исчезать: если его можно представить как header/query без секрета или сложной подписи, importer добавляет header/query entry и warning; иначе оставляет `{ type: 'none' }` и warning.
- Header/query entries с `enabled: false` сохраняются disabled, потому что текущие `HttpHeaderEntry`/`HttpQueryEntry` это поддерживают.
- Empty header/query keys пропускаются с warning только если у них есть value; полностью пустые строки игнорируются без warning.
- Importer возвращает уже normalized `body`, `formData` и `auth`: `body` всегда `string | null`, `formData` всегда array, `auth` всегда задан.
- Preview ограничивает шум: warnings cap 200 на import, дальше добавляется один warning `Additional warnings omitted`.
- v1 file size limit: один файл до 10 MB для Postman/OpenAPI/Bruno YAML и до 25 MB для ZIP. При превышении preview возвращает validation error до parse. Лимиты можно поднять после реальной проверки производительности.
- Environments сохраняются в vault как plain text, как и текущая HTTP space model. Preview должен показывать notice для импортируемых environments с потенциальными secrets; secure secret storage не обещаем.

### Сохранение IR в HTTP space

- Для каждой `ImportCollection` создаётся top-level folder `<Collection name>` в `http/`.
- Import service сам резолвит коллизии имён перед вызовом storage: `<name>`, `<name> 1`, `<name> 2`, ... Storage `createFolder`/`createRequest` остаётся строгим и может вернуть `NAME_CONFLICT`.
- `ImportFolder.parentId: null` означает папку первого уровня внутри folder-а коллекции, а не корень `http/`.
- `ImportRequest.folderId: null` означает request прямо внутри folder-а коллекции.
- Для folders строится `Map<importFolderId, httpFolderId>`; root folder коллекции не попадает в IR, но участвует в remap-е как parent для всех root-level folders/requests.
- Для requests import service делает `createRequest({ name, folderId, method, url })`, затем `updateRequest(id, { headers, query, bodyType, body, formData, auth, description })`. Это соответствует текущему storage contract и не требует расширять `HttpRequestCreateInput` ради импорта.
- Для duplicate request names внутри одной imported folder import service заранее применяет тот же suffix-подход, иначе `createRequest` вернёт `NAME_CONFLICT`.
- Environments создаются через `createEnvironment({ name, variables })`; при конфликте имени import service применяет suffix.
- Все операции выполняются через HTTP storage/API: сначала root collection folders, потом nested folders, потом requests, потом environments. Importer не пишет `.md` и `.state.yaml` напрямую.
- После persist-шага возвращается `ImportPersistSummary` для toast/modal.
- Если request/environment не удалось сохранить из-за validation/storage error, apply endpoint возвращает ошибку без частичного rollback в v1. Это приемлемо, потому что import создаёт новые top-level folders; повторный импорт создаст новую suffixed collection. Транзакционный rollback можно добавить позже, если появится реальная боль.
- При частичном apply failure summary должен включать уже созданные counts и имена top-level collection folders, чтобы UI мог показать пользователю, что именно появилось в HTTP space.

### Runtime scripts и assertions (follow-up)

В v1 импорта pre-request scripts, post-response scripts, tests/assertions не сохраняются и не исполняются, потому что текущая модель HTTP space не имеет runtime hooks для request-а. Importer должен добавлять warnings (`Runtime scripts skipped`, `Assertions skipped`), чтобы пользователь видел потерянное поведение.

Отдельная задача после базового импорта — добавить request runtime в HTTP space:

- Расширить модель HTTP request:
  - `preRequestScript?: string`
  - `postResponseScript?: string`
  - `assertions?: HttpAssertion[]`
- Обновить storage/frontmatter schema и миграцию так, чтобы старые requests без этих полей продолжали открываться без изменений.
- Добавить editor UI:
  - tab/panel `Scripts` с секциями `Pre-request` и `Post-response`
  - tab/panel `Tests` или `Assertions` для декларативных проверок
  - warning/notice, что scripts исполняются локально и могут менять переменные окружения/request context.
- Добавить sandboxed executor в main/runtime, а не в renderer:
  - renderer только редактирует script text и отправляет request на execute через текущий API/IPC path
  - executor получает ограниченный context: request, response, environment variables, helper API для чтения/записи runtime variables
  - без доступа к Node.js, filesystem, shell, Electron и произвольным app internals
- Определить совместимый helper API:
  - минимум для Bruno: `bru.setGlobalEnvVar`, `bru.setEnvVar`, чтение env/global vars
  - минимум для Postman: subset `pm.environment.set/get`, `pm.globals.set/get`, `pm.test`, `pm.expect` или явный warning для неподдержанного API
- Определить порядок execute:
  1. resolve environment/interpolation
  2. run pre-request script
  3. повторно применить изменённые runtime variables к request, если script их поменял
  4. execute HTTP request
  5. run post-response script/tests/assertions
  6. показать результат assertions в response panel
- Persist semantics:
  - scripts/assertions сохраняются как часть request metadata
  - runtime variable changes по умолчанию не должны молча переписывать persisted environment; нужен явный UI/setting для сохранения изменений в environment.
- Import behavior после появления runtime:
  - Bruno OpenCollection `runtime.scripts` переносить в `preRequestScript`/`postResponseScript` по `type`
  - Bruno `runtime.assertions` переносить в `assertions`
  - Postman `event[]` с `listen: "prerequest"` переносить в `preRequestScript`
  - Postman `event[]` с `listen: "test"` переносить в `postResponseScript`/tests
  - Unsupported helper API всё равно должен давать warning.

### API / main boundaries

- Renderer читает выбранные файлы через browser `File` API и отправляет в API только `{ name, content, encoding? }[]`. ZIP передаётся как `base64`; JSON/YAML как text. Renderer не импортирует parser/storage internals.
- Новый API route: `POST /http-import/preview` — auto-detect + parse, возвращает summary, найденные collections/environments и warnings без записи в storage.
- Новый API route: `POST /http-import/apply` — повторно парсит тот же payload с выбранными options и сохраняет через import service. Session/cache для preview не нужен: файлы остаются в renderer state до нажатия OK.
- DTO: `src/main/api/dto/http-import.ts`, route: `src/main/api/routes/http-import.ts`, registration в `src/main/api/index.ts`.
- Parser/service modules держать рядом с HTTP domain, например `src/main/http/import/`: `postman.ts`, `openapi.ts`, `opencollection.ts`, `zip.ts`, `persist.ts`, `types.ts`.
- После добавления DTO/routes обязательно `pnpm api:generate`.

DTO shape v1:

```ts
type HttpImportFile = {
  name: string
  content: string
  encoding?: 'text' | 'base64'
}

type HttpImportPreviewInput = {
  files: HttpImportFile[]
}

type HttpImportApplyInput = HttpImportPreviewInput & {
  selectedCollectionIndexes?: number[]
  selectedEnvironmentIndexes?: number[]
}
```

## Приоритизация форматов

| Этап | Формат | Покрытие | Сложность |
|---|---|---|---|
| **v1** | OpenAPI 3.0 JSON/YAML | API-first команды и backend-generated specs | Средняя |
| **v1** | Postman Collection v2.1 + Environment | распространённый HTTP-client export | Средняя |
| **v1** | Bruno OpenCollection YAML/ZIP | растущая OSS-альтернатива, стандартный export | Средняя |
| **v2** | Insomnia v4 JSON | вторая по популярности OSS | Низкая |
| **v2** | HAR 1.2 | DevTools браузера | Очень низкая |
| **v2** | `.http` / `.rest` (REST Client) | VSCode/JetBrains | Низкая |
| **Backlog** | cURL (одиночная команда из буфера) | полезно для one-off request, но не коллекционный импорт | Низкая |
| **Backlog** | Bruno `.bru` directory | source-format Bruno project | Высокая (DSL + directory import UX) |
| **v3**  | Hoppscotch / Thunder Client | нишевые | Низкая |
| **N/A** | Paw / RapidAPI for Mac | закрытый бинарный формат | через Postman-экспорт |

## Описание форматов

### 1. OpenAPI 3.0 JSON/YAML (v1)

- Расширения: `.yaml`, `.yml`, `.json`
- Не «коллекция запросов», а описание API. Из `paths[path][method]` генерируется один request на operation
- Body — генерировать из `requestBody.content[mime].examples` или из `schema` (заглушки по типам)
- `parameters` (path/query/header) → URL и headers/query. Path params в формате `{id}` конвертировать в `{{id}}`, чтобы они работали с текущей interpolation-моделью.
- Если у path param есть `example`/`default`, можно добавить его в generated environment `<API name> Examples`; если примера нет, переменную не создавать.
- `security` → auth только для bearer/basic. `apiKey` конвертировать в header/query entry по `in` + `name`; если location не поддерживается, warning.
- Парсер: `yaml` + ручная конвертация. Swagger 2.0 отложен до отдельного follow-up, если появится спрос.

### 2. Postman Collection v2.1 (v1)

- Расширение: `.json`
- Schema: <https://schema.postman.com/collection/json/v2.1.0/collection.json>
- Структура рекурсивная: `info` + `item[]`, где `item` — либо folder (`item: [...]`), либо request (`request: {...}`)
- Body modes: `raw | urlencoded | formdata | file | graphql`
- Auth types: `bearer | basic | apikey | oauth2 | digest | awsv4 | ntlm`
- Body mode `file` не поддерживается текущей HTTP model как standalone body: warning. `formdata` file parts поддерживаются как multipart entries.
- Скрипты в `event[]` (`prerequest | test`) — игнорировать в v1, добавить в `warnings`
- Environment — отдельный файл: `{ id, name, values: [{ key, value, enabled, type }] }`
- Collection variables: `variable[]` импортировать в environment `<Collection name> Variables`, если пользователь не выбрал merge с отдельным Postman Environment
- Auth и variables наследуются при рекурсивном обходе `item[]`: collection → folder → request. Request-level auth переопределяет inherited auth. Неподдержанные inherited auth types дают warning; если можно безопасно представить как header, добавить header.
- Disabled environment/collection variables не импортировать, добавлять warning с именем переменной и источником

```json
{
  "info": { "name": "...", "schema": "...v2.1.0/collection.json", "_postman_id": "..." },
  "auth": { "type": "bearer", "bearer": [{ "key": "token", "value": "{{token}}" }] },
  "variable": [{ "key": "baseUrl", "value": "https://api.example.com" }],
  "item": [
    {
      "name": "Folder",
      "item": [
        {
          "name": "Request",
          "request": {
            "method": "GET",
            "header": [{ "key": "...", "value": "..." }],
            "url": { "raw": "...", "host": [...], "path": [...], "query": [...] },
            "body": { "mode": "raw", "raw": "...", "options": {...} },
            "auth": { "type": "bearer", "bearer": [{ "key": "token", "value": "..." }] }
          }
        }
      ]
    }
  ]
}
```

Парсер: ручной (структура понятная, зависимостей не нужно).

### 3. Bruno OpenCollection YAML/ZIP (v1)

- Расширения: `.yaml`, `.yml`, `.zip`
- Поддерживаем Bruno OpenCollection export, а не raw `.bru` project directory.
- ZIP раскрывается в preview/apply pipeline до parse; importer получает список файлов с путями внутри архива.
- Single-file bundled YAML импортируется как одна collection.
- Folder hierarchy строится из OpenCollection path/folder metadata.
- Environments импортируются в текущую HTTP environment model как `Record<string, string>`.
- `runtime.scripts` и `runtime.assertions` не сохраняются в v1 и дают warnings.

### 4. cURL (Backlog)

- Не коллекционный импорт, а one-off request из строки.
- Если вернёмся к фиче, лучше делать отдельную UX-точку `Import from cURL` в request editor/list, а не смешивать с file import dialog.
- Библиотека: [`curlconverter`](https://www.npmjs.com/package/curlconverter) (npm) — поддерживает все распространённые флаги.

### 5. Insomnia v4 JSON (v2)

- Расширение: `.json`
- Структура: плоский `resources[]` с `_type`: `workspace | request | request_group | environment`
- Иерархия — через `parentId`
- Body: `{ mimeType, text }` или `{ mimeType, params: [...] }`
- Парсер: тривиальный (плоский список, два прохода — folders, потом requests)

```json
{
  "_type": "export",
  "__export_format": 4,
  "resources": [
    { "_id": "wrk_1", "_type": "workspace", "name": "..." },
    { "_id": "fld_1", "_type": "request_group", "parentId": "wrk_1", "name": "..." },
    { "_id": "req_1", "_type": "request", "parentId": "fld_1",
      "method": "POST", "url": "...", "headers": [...],
      "body": { "mimeType": "application/json", "text": "..." },
      "authentication": {...}, "parameters": [...] }
  ]
}
```

### 6. HAR 1.2 (v2)

- Расширение: `.har` (JSON)
- Источник: DevTools любого браузера, Charles, Fiddler, Proxyman
- Структура: `log.entries[].request` с `method, url, httpVersion, headers[], queryString[], cookies[], postData{ mimeType, text, params[] }`
- Без папок — все запросы плоские, импортировать в одну группу `Imported HAR <date>`
- Cookies переносить в `Cookie` header, если он ещё не присутствует; иначе warning, чтобы не задублировать данные
- Spec: <http://www.softwareishard.com/blog/har-12-spec/>

### 7. `.http` / `.rest` (v2)

- Plain text. Запросы разделены `###`
- Синтаксис:

  ```
  ### Get user
  @baseUrl = https://api.example.com
  GET {{baseUrl}}/users/1
  Authorization: Bearer {{token}}

  {"any": "json body"}
  ```

- Переменные: `@name = value`, использование `{{name}}`
- Парсер пишется быстро (split по `###`, простая state-machine)

### 8. Bruno `.bru` папка (Backlog)

- Не один файл, а директория: `bruno.json` + один `.bru` на запрос + `environments/*.bru`
- Directory import не должен идти через обычный single-file API. Для v2 выбрать один путь: либо renderer `File` API с `webkitRelativePath` при drag & drop/выборе папки, либо IPC file dialog + main-side read directory. Решение зафиксировать перед реализацией Bruno.
- Собственный DSL (Bru Lang), парсится OHM-грамматикой
- Блоки: `meta`, `get|post|put|...`, `headers`, `query`, `params:path`, `body:json|text|xml|form-urlencoded|multipart-form|graphql|graphql:vars`, `auth:basic|bearer|oauth2|awsv4|digest|wsse|apikey|ntlm`, `vars:pre-request|post-response`, `assert`, `script:pre-request|post-response`, `tests`, `docs`
- Реализация: использовать `@usebruno/lang` напрямую (если лицензия совместима) или написать собственный парсер

### 9. Hoppscotch (v3)

- JSON: `{ name, folders[], requests[] }`
- Запрос: `name, method, endpoint, headers[], params[], body, auth, preRequestScript, testScript`
- Низкий приоритет — нишевый формат

### 10. Thunder Client (v3)

- JSON: `{ client: "Thunder Client", collectionName, version, folders[], requests[] }`
- Каждый request: `_id, colId, containerId, name, url, method, headers[], params[], body{type,raw|form|...}, tests[]`
- Низкий приоритет

### 11. Paw / RapidAPI for Mac (не поддерживаем)

- Закрытый бинарный формат `.paw`
- Решение: документация — «экспортируй из Paw в Postman v2.1 (File → Export), импортируй у нас как Postman»
- Paw это умеет нативно

## UX

### Точки входа

- **Sidebar HTTP space header → кнопка `Import` рядом с `HTTP Client`** → диалог выбора одного или нескольких файлов; auto-detect по расширению/содержимому
- **Postman:** в одном диалоге можно выбрать collection `.json` и optional environment `.json`; preview показывает найденные collections/environments с галочками
- **Drag & drop файла/файлов** в drop zone import dialog → auto-detect → preview
- Если apply завершился с ошибкой после частичной записи, modal показывает created counts и имена collection folders, которые уже были созданы.
- Preview для environments показывает notice: импортируемые переменные сохраняются как plain text в vault.

### Auto-detect

По комбинации расширение + содержимое:

- `.har` → HAR
- `.json` + `info.schema` содержит `postman` → Postman
- `.json` + `_postman_variable_scope: "environment"` или Postman environment shape (`name` + `values[]`) → Postman Environment
- `.json` + `_type: "export"` → Insomnia
- `.json|.yaml|.yml` + `openapi:` → OpenAPI
- `.yaml|.yml|.zip` + Bruno OpenCollection shape → Bruno OpenCollection
- `.http|.rest` → REST Client format
- директория с `bruno.json` → Bruno `.bru` directory (backlog)
- ничего не подошло → попросить пользователя указать формат вручную

### Обработка warnings

После импорта показать toast: «Imported N requests in M collections. K features were skipped.» + кнопка «Show details» открывает modal со списком warnings (например, `Pre-request scripts skipped in 'Auth/Login'`, `Disabled environment variable 'token' skipped`, `OAuth2 auth fallback to header in 'Get user'`).

## Открытые вопросы

- Куда складывать импортированные коллекции — **решение:** всегда новая top-level папка `<Collection name>` в `http/`; root requests коллекции кладутся внутрь неё. При коллизии имени import service заранее подбирает безопасное уникальное имя и только потом вызывает storage.
- Как импортировать переменные окружения — **решение для v1:** объединить в один диалог импорта со списком «что найдено» и галочками. В текущую модель HTTP space сохраняются только enabled variables как `Record<string, string>`, disabled variables пропускаются с warning.
- GraphQL body — поддерживаем как `application/json` с `{ query, variables }` или вводим отдельный `bodyType: graphql`? Зависит от планов на GraphQL в HTTP space — обсудить отдельно
- Скрипты и assertions — **решение:** в v1 импорта игнорируем + warning. Raw «на будущее» в frontmatter не сохраняем, пока нет runtime/editor модели; follow-up описан в разделе `Runtime scripts и assertions`.
- Bruno directory import — **решение отложено до v2:** перед реализацией выбрать renderer `webkitRelativePath` или IPC directory reader, чтобы не смешивать file import UX с main-side filesystem access.

## Этапы

1. **v1 (этап 1):** OpenAPI 3.0 JSON/YAML + Postman v2.1 + Postman Environment + Bruno OpenCollection YAML/ZIP
2. **v2 (этап 2):** Insomnia v4 + HAR + `.http` / `.rest`
3. **Backlog:** cURL one-off import + Bruno `.bru` directory import
4. **v2 follow-up:** HTTP request runtime — pre-request scripts, post-response scripts, tests/assertions + импорт этих полей из Bruno/Postman
5. **v3 (этап 4):** Hoppscotch + Thunder Client — по фидбеку

Каждый этап — отдельный PR с полным набором: парсер + тесты на golden fixtures + UI-точка входа + auto-detect + i18n keys. Если PR добавляет/меняет API DTO или routes — `pnpm api:generate`.

## Источники

- [Postman Collection v2.1.0 Schema](https://schema.postman.com/collection/json/v2.1.0/draft-07/docs/index.html)
- [Postman schemas repository](https://github.com/postmanlabs/schemas)
- [Bruno Import & Export System](https://deepwiki.com/usebruno/bruno/5.4-import-and-export-system)
- [Bruno bru-lang spec (parser)](https://github.com/usebruno/bruno/blob/main/packages/bruno-lang/v2/src/bruToJson.js)
- [Insomnia Import & Export reference](https://developer.konghq.com/insomnia/import-export/)
- [Insomnia source: import.ts](https://github.com/Kong/insomnia/blob/develop/packages/insomnia/src/common/import.ts)
- [HAR 1.2 Spec (W3C draft)](https://w3c.github.io/web-performance/specs/HAR/Overview.html)
- [HAR 1.2 Spec (softwareishard)](http://www.softwareishard.com/blog/har-12-spec/)
- [OpenAPI Specification](https://swagger.io/specification/)
- [VSCode REST Client extension](https://github.com/Huachao/vscode-restclient)
- [VS 2022 .http format](https://learn.microsoft.com/en-us/aspnet/core/test/http-files)
- [Hoppscotch Importer docs](https://docs.hoppscotch.io/documentation/features/importer)
- [Thunder Client Import/Export docs](https://docs.thunderclient.com/features/import)
- [Paw → Postman exporter](https://paw.cloud/docs/exporters/postman-exporter)
- [curlconverter (npm)](https://www.npmjs.com/package/curlconverter)
