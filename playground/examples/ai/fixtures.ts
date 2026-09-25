// Code samples intentionally contain literal JavaScript template expressions.
/* eslint-disable no-template-curly-in-string */
import type {
  AiContext,
  ChatMessage,
} from '../../../src/renderer/composables/ai/useAi'
import type { AiVaultItem } from '../../../src/shared/ai'
import type { AiHttpProposal } from '../../../src/shared/aiHttp'
import type {
  AiHttpActionView,
  AiHttpRequestPreview,
} from '../../../src/shared/aiHttpActions'
import type {
  AiNativeAction,
  AiNativeActionView,
} from '../../../src/shared/aiNativeActions'
import type {
  WorkspaceChange,
  WorkspaceOperation,
  WorkspaceProposal,
} from '../../../src/shared/aiWorkspace'
import type { Scenario } from './types'

function item(type: AiVaultItem['type'] = 'snippet', id = 135, name = 'Fetch user profile') {
  return { type, id, name }
}
const items = [
  item(),
  item('note', 136, 'API integration checklist'),
  {
    ...item('http_request', 137, 'Get profile'),
    method: 'GET',
    url: 'https://api.example.com/v1/profile',
  },
]
function answer(extra: Partial<ChatMessage> = {}): ChatMessage {
  return {
    role: 'assistant',
    status: 'done',
    content: '',
    createdAt: 1790298000000,
    ...extra,
  }
}
const contextId = '00000000-0000-4000-8000-000000000001'
const edit: NonNullable<ChatMessage['edit']> = {
  contextId,
  vault: '/demo',
  text: 'function greet(name) {\n  return "Hello " + name\n}',
  from: 0,
  to: 46,
  space: 'code',
  snippetId: 135,
  contentId: 1,
}
export const demoRecords = [
  item(),
  item('snippet', 138, 'Validate response'),
  ...items.slice(1),
  ...Array.from({ length: 5 }, (_, index) =>
    item(
      'snippet',
      140 + index,
      `Very long shared API response validation helper ${index + 1}`,
    )),
]
export const demoEditor: AiContext = {
  name: 'Greeting',
  space: 'code',
  snippetId: 139,
  contentId: 1,
  text: edit.text,
  selection: 'return "Hello " + name',
  language: 'javascript',
  selectionFrom: edit.text.indexOf('return'),
  selectionTo: edit.text.indexOf('return') + 'return "Hello " + name'.length,
}
const replacement
  = 'function greet(name: string): string {\n  return `Hello ${name}`\n}'
const checks: AiHttpProposal = {
  context_id: contextId,
  summary: 'Проверить статус и профиль',
  analysis: 'Предлагаю проверить статус ответа и структуру профиля.',
  assertions: [
    {
      name: 'Success response',
      source: 'status',
      operator: 'eq',
      expected: 200,
    },
    {
      name: 'Email exists',
      source: 'json',
      path: '/user/email',
      operator: 'exists',
    },
    {
      name: 'Content type',
      source: 'header',
      path: 'content-type',
      operator: 'contains',
      expected: 'application/json',
    },
  ],
  evidence: [
    {
      assertionIndex: 0,
      source: 'user',
      quote: 'Ожидается успешный ответ со статусом 200',
    },
  ],
}
function change(
  name: string,
  space: WorkspaceOperation['space'] = 'code',
  kind: WorkspaceOperation['kind'] = 'item',
): WorkspaceChange {
  const fields: WorkspaceOperation['fields']
    = kind === 'folder'
      ? { name }
      : space === 'http'
        ? { name, method: 'GET', url: 'https://api.example.com/v1/profile' }
        : {
            name,
            content: 'const timeout = 5000',
            ...(space === 'code' ? { language: 'javascript' } : {}),
          }
  return {
    name,
    before: '{}',
    after: JSON.stringify(fields),
    operation: { space, kind, action: 'create', fields },
  }
}
const creationProposal: WorkspaceProposal = {
  id: 'workspace-create',
  summary: 'Создать сниппет и заметку.',
  changes: [
    change('Fetch user profile'),
    change('API integration checklist', 'notes'),
  ],
}
const updatedCode: WorkspaceChange = {
  ...change('Fetch user profile'),
  before: JSON.stringify({
    name: 'Fetch user profile',
    content: 'const timeout = 1000',
    tags: ['draft'],
  }),
  after: JSON.stringify({
    name: 'Fetch user profile',
    content: 'const timeout = 5000',
    tags: ['api'],
  }),
  operation: {
    space: 'code',
    kind: 'item',
    action: 'update',
    id: 135,
    fields: { content: 'const timeout = 5000', tags: ['api'] },
  },
}
const proposal: WorkspaceProposal = {
  id: 'workspace-demo',
  summary: 'Обновить код и теги, создать заметку с документацией.',
  changes: [updatedCode, change('API integration checklist', 'notes')],
}
const request: AiHttpRequestPreview = {
  requestId: 137,
  method: 'GET',
  name: 'Get profile',
  url: 'https://api.example.com/v1/profile',
  environmentName: 'Staging',
  bodyType: 'none',
  bodyCharacters: 0,
  formEntries: 0,
  headers: 2,
  authType: 'bearer',
  transport: {
    timeoutMs: 30000,
    maxRedirects: 5,
    protocolVersion: 'http1',
    skipCertificateVerification: false,
  },
  scripts: [],
}
export const scenarios: Scenario[] = []
function add(
  group: string,
  title: string,
  description: string,
  message: Partial<ChatMessage>,
  extra: Partial<Scenario> = {},
) {
  const reply = answer(message)
  const pending
    = reply.httpActions?.some(action => action.state === 'pending')
      || reply.nativeActions?.some(action => action.status === 'pending')
  const running
    = reply.httpActions?.some(action => action.state === 'running')
      || reply.nativeActions?.some(action => action.status === 'running')
  if (pending || running) {
    reply.status = 'streaming'
    reply.taskState = pending ? 'waitingConfirmation' : 'waitingNative'
    reply.actionRequestId = contextId
  }
  for (const creation of reply.workspaceCreations ?? []) {
    reply.taskMutations = creation.applied.map(index => ({
      kind: 'workspace',
      id: creation.proposal.id,
      index,
      undone: creation.undone.includes(index),
    }))
  }
  scenarios.push({
    id: String(scenarios.length + 1).padStart(2, '0'),
    group,
    title,
    description,
    conversation: {
      messages: [
        {
          role: 'user',
          content: message.httpProposal
            ? 'Ожидается успешный ответ со статусом 200. Проверь наличие email и Content-Type.'
            : title,
        },
        reply,
      ],
    },
    ...extra,
    streaming: pending || running || extra.streaming,
  })
}
add('Текст', 'Короткий ответ', 'Обычный ответ, копирование и время.', {
  content:
    'В функции не обрабатывается ошибка сети. Добавьте `try/catch` и проверьте `response.ok` перед чтением JSON.',
})
add(
  'Текст',
  'Markdown и код',
  'Заголовки, список, цитата, таблица, подсветка и копирование кода.',
  {
    content:
      '## Обработка ответа\n\n1. Проверьте HTTP-статус.\n2. Прочитайте JSON.\n3. Верните профиль.\n\n> Ошибка сети и HTTP-ошибка требуют отдельной обработки.\n\n```typescript\nasync function loadProfile() {\n  const response = await fetch("/api/profile")\n  if (!response.ok) throw new Error(`HTTP ${response.status}`)\n  return response.json()\n}\n```\n\n| Состояние | Действие |\n| --- | --- |\n| 200 | Вернуть профиль |\n| 401 | Запросить авторизацию |\n\n**Готово.** Подробнее: [MDN](https://developer.mozilla.org/).',
  },
)
add(
  'Текст',
  'Ссылки на записи',
  'Инлайн-ссылки на snippet, note и HTTP request.',
  {
    content:
      'Используйте Fetch user profile вместе с API integration checklist. Запрос Get profile поможет проверить результат.',
    attachments: items,
  },
)
add('Текст', 'Длинный ответ', 'Прокрутка, длинные имена и переносы.', {
  content: Array.from(
    { length: 12 },
    (_, i) =>
      `### Шаг ${i + 1}\n\nПроверьте обработку ответа и сохранение данных. \`very_long_configuration_property_for_network_response_validation_${i}\`\n\n- Успешный ответ\n- Пустой результат\n- Ошибка соединения`,
  ).join('\n\n'),
})
add(
  'Контекст и поиск',
  'Несколько записей',
  'Два сниппета, прикреплённые через поиск. Без выделенного кода.',
  {},
  {
    conversation: {
      messages: [
        {
          role: 'user',
          content: 'Проверь эти два сниппета',
          attachments: demoRecords.slice(0, 2),
          contextMode: 'none',
        },
        answer({ content: 'Проверил загрузку профиля и валидацию ответа.' }),
      ],
    },
  },
)
add(
  'Контекст и поиск',
  'Выделенный код',
  'Только выделенная строка редактора. В аккордеоне — отправленный фрагмент.',
  {},
  {
    conversation: {
      messages: [
        {
          role: 'user',
          content: 'Добавь проверку имени',
          contextMode: 'selection',
          context: demoEditor.selection,
          editorSnapshot: demoEditor,
        },
        answer({
          content: 'Добавлю проверку имени перед формированием приветствия.',
        }),
      ],
    },
  },
)
add(
  'Контекст и поиск',
  'Результаты поиска',
  'В аккордеоне — ссылки; метод и URL — в тексте ответа.',
  {
    searchResults: [{ queries: ['profile'], items, total: 3, expanded: true }],
    content:
      'Нашёл три записи: Fetch user profile, API integration checklist и Get profile.\n\nGet profile выполняет `GET https://api.example.com/v1/profile`.',
  },
)
add(
  'Контекст и поиск',
  'Поиск: ограниченная выдача',
  'Усечённый результат и непрочитанные записи.',
  {
    searchResults: [
      { queries: ['profile'], items, total: 28, expanded: false },
    ],
    content: 'Нашёл 28 записей. Показаны первые три.',
  },
)
add(
  'Контекст и поиск',
  'Поиск: ничего не найдено',
  'Пустой search result скрывается текущей панелью; остаётся текст.',
  {
    searchResults: [
      { queries: ['profile'], items: [], total: 0, expanded: true },
    ],
    content: 'Записей с таким названием не найдено.',
  },
)
for (const [state, title] of Object.entries({
  working: 'Генерация',
  waitingConfirmation: 'Ожидание подтверждения',
  waitingNative: 'Ожидание приложения',
  waitingAnswer: 'Ожидание ответа',
})) {
  add(
    'Ход задачи',
    title,
    'Активная задача и индикатор генерации.',
    {
      status: 'streaming',
      taskState: state as ChatMessage['taskState'],
      workspaceContext:
        state === 'working'
          ? { space: 'code', selectedIds: [135, 136] }
          : undefined,
      content: state === 'working' ? 'Проверяю выбранный код…' : '',
    },
    { streaming: true },
  )
}
add(
  'Ход задачи',
  'Уточняющий вопрос',
  'Варианты ответа и свободный ввод. Кнопки работают локально.',
  {
    status: 'streaming',
    taskState: 'waitingAnswer',
    clarification: {
      id: 'q1',
      question: 'Как обрабатывать пустой ответ сервера?',
      options: ['Вернуть null', 'Выбросить ошибку', 'Вернуть пустой объект'],
    },
  },
  { streaming: true },
)
add(
  'Ход задачи',
  'Уточнение получено',
  'Отвеченный вопрос и дополнительная инструкция.',
  {
    clarification: {
      id: 'q1',
      question: 'Как обрабатывать пустой ответ?',
      answer: 'Вернуть null',
    },
    steering: ['Сохрани существующие имена функций.'],
    content: 'Учёл уточнение и сохранил имена функций.',
  },
)
add('Ход задачи', 'Вопрос закрыт', 'Закрытое уточнение без ответа.', {
  clarification: {
    id: 'q1',
    question: 'Обновить также тесты?',
    cancelled: true,
  },
  status: 'cancelled',
})
add(
  'Ход задачи',
  'Генерация остановлена',
  'Частичный ответ, статус отмены и повтор.',
  { status: 'cancelled', content: 'Я проверил функцию и нашёл два случая…' },
)
add(
  'Редактирование',
  'Предложение изменения кода',
  'Откройте review: настоящий diff, принятие и отклонение.',
  { edit, replacement, proposalSummary: 'Добавить типы и template string.' },
)
add(
  'Редактирование',
  'Изменение применено',
  'Подтверждение и отмена действий задачи.',
  {
    edit,
    replacement,
    applied: true,
    content: 'Изменения применены.',
    taskMutations: [
      { kind: 'editor', snapshot: edit, calls: [], undone: false },
    ],
  },
)
add('Редактирование', 'Изменение отклонено', 'Отклонённое предложение.', {
  edit,
  replacement,
  rejected: true,
  content: 'Изменение отклонено.',
})
add(
  'Редактирование',
  'Контекст устарел',
  'Откройте review: предупреждение и недоступное применение.',
  {
    edit,
    replacement,
    proposalSummary: 'Файл изменился после отправки запроса.',
  },
  { stale: true },
)
add(
  'Редактирование',
  'Некорректное предложение',
  'Ответ модели без применимой замены.',
  { edit, editRequested: true },
)
add(
  'Рабочее пространство',
  'Пакет изменений',
  'Выбор операций, diff содержимого и тегов.',
  { workspaceProposal: proposal, proposalSummary: proposal.summary },
)
add(
  'Рабочее пространство',
  'Необратимое удаление',
  'Review с предупреждением о последствиях.',
  {
    workspaceProposal: {
      ...proposal,
      changes: [
        {
          ...change('Old profile'),
          irreversible: true,
          operation: {
            action: 'permanentDelete',
            kind: 'item',
            space: 'code',
            id: 135,
            fields: {},
          },
          before: JSON.stringify({ name: 'Old profile' }),
          after: '{}',
        },
      ],
    },
    proposalSummary: 'Удалить запись окончательно.',
  },
)
for (const [state, title] of Object.entries({
  success: 'Создание записей',
  partial: 'Частичный успех создания',
  undone: 'Создание отменено',
})) {
  add(
    'Рабочее пространство',
    title,
    'Результаты операций, ссылки и локальная отмена.',
    {
      workspaceCreations: [
        {
          proposal: creationProposal,
          containers: [],
          applied: state === 'partial' ? [0] : [0, 1],
          undone: state === 'undone' ? [0, 1] : [],
          failedOperationIndex: state === 'partial' ? 1 : undefined,
          items:
            state === 'partial'
              ? [{ ...items[0], operationIndex: 0 }]
              : [
                  { ...items[0], operationIndex: 0 },
                  { ...items[1], operationIndex: 1 },
                ],
        },
      ],
    },
  )
}
add(
  'Рабочее пространство',
  'Конфликт отката',
  'Часть изменений нельзя отменить; есть необратимое действие.',
  {
    content: 'Не все изменения удалось отменить.',
    taskMutations: [
      { kind: 'workspace', id: proposal.id, index: 0, undone: false },
    ],
    undoConflicts: ['Fetch user profile', 'API integration checklist'],
    taskIrreversible: true,
  },
)
add(
  'HTTP-проверки',
  'Предложенные assertions',
  'Таблица проверок и review с доказательствами.',
  {
    httpProposal: checks,
    httpSnapshot: {
      baseline: 'demo',
      context: {
        contextId,
        requestId: 137,
        name: 'Get profile',
        request: '{}',
        response: null,
        assertions: [],
      },
    },
  },
)
add(
  'HTTP-проверки',
  'Проверки применены',
  'Таблица и подтверждение сохранения.',
  { httpProposal: checks, applied: true },
)
add(
  'HTTP-проверки',
  'Проверки устарели',
  'В review показана невозможность применения.',
  { httpProposal: checks },
  { stale: true },
)
function http(extra: Partial<AiHttpActionView> = {}): AiHttpActionView {
  return {
    id: 'http-demo',
    summary: 'Отправить запрос Get profile',
    state: 'pending',
    source: 'saved',
    action: 'send',
    request,
    preview: { method: 'GET', url: request.url },
    ...extra,
  }
}
add(
  'HTTP-действия',
  'Подтверждение запроса',
  'Параметры, окружение, кнопки и диагностика.',
  { httpActions: [http()] },
)
add('HTTP-действия', 'Запуск коллекции', 'Список шагов и политика остановки.', {
  httpActions: [
    http({
      action: 'runCollection',
      source: 'workspace',
      request: undefined,
      run: {
        skipCertificateVerification: false,
        view: {
          runId: contextId,
          folderId: 200,
          state: 'ready',
          folderName: 'Profile API',
          environmentName: 'Staging',
          steps: [
            {
              requestId: 137,
              method: 'GET',
              name: 'Get profile',
              state: 'pending',
              folderPath: 'Profile API',
            },
            {
              requestId: 138,
              method: 'POST',
              name: 'Update profile',
              state: 'pending',
              folderPath: 'Profile API',
            },
          ],
        },
        requests: [
          request,
          { ...request, method: 'POST', name: 'Update profile' },
        ],
        continueOnFailure: false,
      },
    }),
  ],
})
add(
  'HTTP-действия',
  'WebSocket-сообщение',
  'Предпросмотр сообщения и предупреждение.',
  {
    httpActions: [
      http({
        action: 'sendWebSocket',
        source: 'workspace',
        request: undefined,
        message: {
          characters: 22,
          connectionId: contextId,
          text: '{"event":"subscribe"}',
        },
        irreversible: true,
      }),
    ],
  },
)
add(
  'HTTP-действия',
  'Изменение cookie',
  'Изменение флага secure у сохранённой cookie.',
  {
    httpActions: [
      http({
        action: 'cookieMetadata',
        source: 'workspace',
        request: undefined,
        cookie: {
          name: 'session',
          changes: [{ field: 'secure', before: false, after: true }],
        },
      }),
    ],
  },
)
for (const state of ['running', 'done', 'cancelled', 'failed'] as const) {
  add(
    'HTTP-действия',
    `HTTP: ${state}`,
    'Статус действия и раскрываемая диагностика.',
    {
      httpActions: [
        http({
          state,
          result:
            state === 'failed'
              ? { error: 'ECONNREFUSED' }
              : state === 'done'
                ? { status: 200, durationMs: 143 }
                : undefined,
        }),
      ],
    },
  )
}
function native(operation: AiNativeAction, extra: Partial<AiNativeActionView> = {}): AiNativeActionView {
  return {
    id: contextId,
    status: 'pending',
    summary: 'Выполнить действие в приложении',
    operation,
    ...extra,
  }
}
add(
  'Действия приложения',
  'Открыть предпросмотр кода',
  'Подтверждение выполнения кода.',
  {
    status: 'streaming',
    taskState: 'waitingConfirmation',
    attachments: [items[0]],
    nativeActions: [
      native({
        action: 'setView',
        view: 'codePreview',
        target: { space: 'code', id: 135 },
      }),
    ],
  },
  { streaming: true },
)
add(
  'Действия приложения',
  'Изменение настроек',
  'Предпросмотр конкретных настроек.',
  {
    status: 'streaming',
    nativeActions: [
      native({
        action: 'setPreferences',
        change: { group: 'code', values: { fontSize: 14, tabSize: 2 } },
      }),
    ],
  },
  { streaming: true },
)
add(
  'Действия приложения',
  'Передача управления',
  'Действие с хранилищем и предупреждение о границе задачи.',
  {
    status: 'streaming',
    nativeActions: [native({ action: 'storage', command: 'move' })],
  },
  { streaming: true },
)
add(
  'Действия приложения',
  'Профиль ИИ сохранён',
  'Сохранение профиля, проверка соединения и перезагрузка.',
  {
    nativeActions: [
      native(
        { action: 'configureAi' },
        {
          status: 'done',
          result: {
            id: contextId,
            status: 'done',
            profile: {
              provider: 'openai',
              model: 'demo-model',
              saved: true,
              connectionCheck: 'passed',
            },
            reloadRequired: true,
          },
        },
      ),
    ],
  },
)
for (const status of ['running', 'done', 'cancelled', 'failed'] as const) {
  add(
    'Действия приложения',
    `Приложение: ${status}`,
    'Статус нативного действия.',
    {
      nativeActions: [
        native(
          {
            action: 'copy',
            part: 'content',
            target: { space: 'code', id: 135 },
          },
          {
            status,
            result:
              status === 'done' ? { id: contextId, status: 'done' } : undefined,
          },
        ),
      ],
    },
  )
}
for (const kind of ['import', 'export'] as const) {
  for (const status of [
    'pending',
    'opened',
    'previewed',
    'applied',
    'cancelled',
    'failed',
  ] as const) {
    add(
      'Импорт и экспорт',
      `${kind}: ${status}`,
      'Краткая строка статуса операции с данными.',
      {
        dataActions: [
          kind === 'import'
            ? {
                id: 'data-demo',
                kind,
                status,
                input: { space: 'code', source: 'github-gists' },
              }
            : {
                id: 'data-demo',
                kind,
                status,
                input: {
                  kind: 'note',
                  id: 136,
                  format: 'html',
                  source: 'saved',
                },
              },
        ],
        content: status === 'applied' ? 'Операция завершена.' : '',
      },
    )
  }
}
add(
  'Системные состояния',
  'История сокращена',
  'Уведомление о сокращённом контексте истории.',
  { content: 'Продолжим с последнего запроса.' },
  { historyOmitted: true },
)

add(
  'Действия приложения',
  'Результат операции с хранилищем',
  'Счётчики, предупреждения и итог обновления хранилища.',
  {
    nativeActions: [
      native(
        { action: 'storage', command: 'doctorApply' },
        {
          status: 'done',
          result: {
            id: contextId,
            status: 'done',
            storage: {
              operationCompleted: true,
              activeVaultChanged: false,
              refreshCompleted: true,
              applied: 12,
              blocked: 2,
              conflicts: 1,
              warnings: 3,
              affectedFiles: 14,
            },
          },
        },
      ),
    ],
  },
)
for (const status of ['stale', 'unavailable'] as const) {
  add(
    'Действия приложения',
    `Приложение: ${status}`,
    'Действие недоступно или его цель изменилась.',
    {
      nativeActions: [
        native(
          {
            action: 'copy',
            part: 'content',
            target: { space: 'code', id: 135 },
          },
          { status },
        ),
      ],
    },
  )
}
add(
  'Действия приложения',
  'Чувствительные настройки',
  'Предупреждение в review настроек HTTP.',
  {
    status: 'streaming',
    nativeActions: [
      native({
        action: 'setPreferences',
        change: {
          group: 'http',
          values: { skipCertificateVerification: true },
        },
      }),
    ],
  },
  { streaming: true },
)
add(
  'HTTP-действия',
  'Запрос со скриптами',
  'Сертификаты и предупреждение о выполнении скриптов.',
  {
    httpActions: [
      http({
        request: {
          ...request,
          transport: {
            ...request.transport,
            skipCertificateVerification: true,
          },
          scripts: [
            {
              source: 'request',
              id: 137,
              preRequest: true,
              postResponse: false,
              trusted: false,
            },
            {
              source: 'collection',
              id: 200,
              preRequest: false,
              postResponse: true,
              trusted: true,
            },
          ],
        },
      }),
    ],
  },
)
add(
  'Рабочее пространство',
  'Создание папки и HTTP-запроса',
  'Остальные виды созданных объектов и невыполненная операция.',
  {
    workspaceCreations: [
      {
        proposal: {
          ...proposal,
          changes: [
            change('API folder', 'code', 'folder'),
            {
              ...change('Profile collection', 'http', 'folder'),
              after: JSON.stringify({
                name: 'Profile collection',
                collection: true,
              }),
              operation: {
                kind: 'folder',
                space: 'http',
                action: 'create',
                fields: { name: 'Profile collection', collection: true },
              },
            },
            change('Get profile', 'http'),
            change('Skipped request', 'http'),
          ],
        },
        containers: [
          {
            id: 201,
            name: 'API folder',
            space: 'code',
            kind: 'folder',
            operationIndex: 0,
          },
          {
            id: 202,
            name: 'Profile collection',
            space: 'http',
            kind: 'collection',
            operationIndex: 1,
          },
        ],
        applied: [0, 1, 2],
        failedOperationIndex: 3,
        undone: [],
        items: [{ ...items[2], operationIndex: 2 }],
      },
    ],
  },
)
add(
  'HTTP-проверки',
  'Проверки отклонены',
  'Состояние отклонённого предложения проверок.',
  { httpProposal: checks, rejected: true },
)
add(
  'Рабочее пространство',
  'Оставшиеся изменения отклонены',
  'Частичное применение пакета и отказ от остатка.',
  { workspaceProposal: proposal, workspaceApplied: [0], rejected: true },
)
add(
  'Контекст и поиск',
  'Смешанный контекст',
  'Два сниппета из поиска и выделенный код другого сниппета. Такой набор можно собрать через плюс в панели ввода.',
  {},
  {
    conversation: {
      messages: [
        {
          role: 'user',
          content: 'Используй профиль и валидацию в этом приветствии',
          attachments: demoRecords.slice(0, 2),
          contextMode: 'selection',
          context: demoEditor.selection,
          editorSnapshot: demoEditor,
        },
        answer({
          content: 'Свяжу приветствие с проверенными данными профиля.',
        }),
      ],
    },
  },
)

for (const scenario of scenarios) {
  for (const message of scenario.conversation.messages) {
    if (message.httpProposal && !message.httpSnapshot) {
      message.httpSnapshot = {
        baseline: 'demo',
        context: {
          contextId,
          requestId: 137,
          name: 'Get profile',
          request: '{}',
          response: null,
          assertions: [],
        },
      }
    }
  }
}

add(
  'Начало работы',
  'Пустой чат',
  'Можно написать сообщение и собрать контекст через плюс.',
  {},
  { conversation: { messages: [], draft: '' } },
)
add(
  'Начало работы',
  'ИИ не настроен',
  'Подсказка настройки и недоступная отправка.',
  {},
  {
    configured: false,
    conversation: { messages: [], draft: 'Объясни этот код' },
  },
)
add(
  'Начало работы',
  'Многострочный ввод',
  'Высота поля, переносы, вложения и кнопка отправки.',
  {},
  {
    conversation: {
      messages: [],
      draft:
        'Проверь обработку ошибок.\nСохрани имена функций.\nДобавь пример использования.\nОпиши ограничения.',
    },
    composer: { mode: 'none', attachments: demoRecords.slice(0, 2) },
  },
)
add(
  'Контекст и поиск',
  'Весь фрагмент редактора',
  'Отправленный буфер редактора целиком, включая несохранённый текст.',
  {},
  {
    conversation: {
      messages: [
        {
          role: 'user',
          content: 'Проверь функцию',
          context: demoEditor.text,
          contextMode: 'fragment',
          editorSnapshot: demoEditor,
        },
        answer({ content: 'Проверил весь фрагмент.' }),
      ],
    },
    composer: { mode: 'fragment', editor: demoEditor, attachments: [] },
  },
)
const noteEditor: AiContext = {
  space: 'notes',
  noteId: 136,
  name: 'API integration checklist',
  text: '# API integration\n\n- Проверить статус\n- Проверить структуру ответа',
  selection: '',
  language: 'markdown',
}
add(
  'Контекст и поиск',
  'Заметка в контексте',
  'Целая заметка и подпись контекста заметки в панели ввода.',
  {},
  {
    conversation: {
      messages: [
        {
          role: 'user',
          content: 'Дополни чеклист',
          context: noteEditor.text,
          contextMode: 'fragment',
          editorSnapshot: noteEditor,
        },
        answer({ content: 'Добавлю проверку сетевых ошибок.' }),
      ],
    },
    composer: { mode: 'fragment', editor: noteEditor, attachments: [] },
  },
)
add(
  'Контекст и поиск',
  'Автоматическая текущая запись',
  'Текущая сохранённая запись автоматически прикреплена к новому чату.',
  {},
  {
    conversation: { messages: [] },
    composer: { mode: 'none', attachments: [items[0]] },
  },
)
add(
  'Контекст и поиск',
  'Выделение рабочего пространства',
  'Выбраны две записи списка; это отдельный контекст, а не количество вложений.',
  {},
  {
    conversation: {
      messages: [
        {
          role: 'user',
          content: 'Проверь выделенные записи',
          workspaceContext: { space: 'code', selectedIds: [135, 138] },
        },
        answer({ content: 'Проверил выбранные записи.' }),
      ],
    },
    composer: {
      mode: 'none',
      attachments: [],
      workspace: { space: 'code', selectedIds: [135, 138] },
    },
  },
)
add(
  'Контекст и поиск',
  'Лимит вложений',
  'Восемь вложений с длинными именами. Удалите одно, чтобы добавить другое.',
  {},
  {
    conversation: { messages: [] },
    composer: { mode: 'none', attachments: demoRecords.slice(0, 8) },
  },
)
for (const [search, label] of [
  ['loading', 'Загрузка'],
  ['empty', 'Нет результатов'],
  ['error', 'Ошибка'],
] as const) {
  add(
    'Контекст и поиск',
    `Поиск вложений: ${label}`,
    'Откройте плюс в панели ввода. Загрузка длится 2,5 секунды.',
    {},
    { search, conversation: { messages: [] } },
  )
}
add(
  'Ход задачи',
  'Потоковый ответ с кодом',
  'Текст и незакрытый code block появляются постепенно. Доступны Stop и очередь.',
  { content: '', status: 'streaming', taskState: 'working' },
  { streaming: true, animate: true },
)
add(
  'Ход задачи',
  'Свободное уточнение',
  'Уточняющий вопрос без готовых вариантов; после ответа работа продолжается.',
  {
    status: 'streaming',
    taskState: 'waitingAnswer',
    clarification: {
      id: 'free-question',
      question: 'Какой формат результата нужен?',
    },
  },
  { streaming: true },
)
add(
  'Ход задачи',
  'Очередь задач',
  'Две задачи со своим контекстом. Stop останавливает текущую; Start запускает следующую.',
  {
    status: 'streaming',
    taskState: 'working',
    content: 'Проверяю первую функцию…',
  },
  { streaming: true },
)
scenarios.at(-1)!.conversation.queue = [
  {
    id: 'queue-1',
    prompt: 'Проверь выделенное приветствие',
    context: { mode: 'selection', editor: demoEditor, attachments: [] },
  },
  {
    id: 'queue-2',
    prompt: 'Проверь чеклист API',
    context: { mode: 'none', attachments: [items[1]] },
  },
]
for (const allowed of [true, false]) {
  add(
    'HTTP-действия',
    allowed ? 'Доверие скриптам' : 'Отзыв доверия скриптам',
    'Отдельная операция доступа для скриптов запроса.',
    {
      httpActions: [
        http({
          action: 'scriptTrust',
          source: 'workspace',
          request: undefined,
          preview: { requestId: 137, allowed },
          trust: { allowed },
        }),
      ],
    },
  )
}
add(
  'HTTP-действия',
  'Отправка черновика',
  'Подтверждение отправки текущего несохранённого HTTP-запроса.',
  { httpActions: [http({ source: 'draft' })] },
)
add(
  'HTTP-действия',
  'Изменение черновика',
  'Локальное изменение полей HTTP-запроса без отправки.',
  {
    httpActions: [
      http({
        action: 'patchDraft',
        source: 'draft',
        changedFields: ['headers', 'url'],
        preview: { url: 'https://api.example.com/v2/profile', headers: [] },
      }),
    ],
  },
)
add(
  'HTTP-действия',
  'Ответ HTTP 500',
  'Запрос выполнен; статус 500 — ответ сервера, а не ошибка транспорта.',
  {
    httpActions: [
      http({
        state: 'done',
        result: {
          id: contextId,
          status: 500,
          durationMs: 143,
          body: '{"error":"Internal Server Error"}',
        },
      }),
    ],
  },
)
for (const state of ['done', 'cancelled'] as const) {
  const collection: AiHttpActionView = JSON.parse(
    JSON.stringify(
      scenarios
        .find(scenario => scenario.title === 'Запуск коллекции')!
        .conversation
        .messages
        .at(-1)!.httpActions![0],
    ),
  )
  collection.state = state
  collection.run!.view.state = state === 'done' ? 'passed' : 'cancelled'
  collection.run!.view.steps.forEach((step) => {
    step.state = state === 'done' ? 'passed' : 'skipped'
  })
  add(
    'HTTP-действия',
    `Коллекция: ${state}`,
    'Завершённый запуск с кнопкой открытия результатов.',
    { httpActions: [collection] },
  )
}
const httpUpdate: WorkspaceChange = {
  name: 'Get profile',
  before: JSON.stringify({ url: 'https://api.example.com/v1/profile' }),
  after: JSON.stringify({ url: 'https://api.example.com/v2/profile' }),
  operation: {
    space: 'http',
    kind: 'item',
    action: 'update',
    id: 137,
    fields: { url: 'https://api.example.com/v2/profile' },
  },
}
add(
  'Рабочее пространство',
  'HTTP review: несохранённые изменения',
  'В review применение заблокировано. Снимите флаг несохранённых изменений для продолжения.',
  {
    workspaceProposal: {
      id: 'http-update',
      summary: 'Обновить URL',
      changes: [httpUpdate],
    },
  },
  { dirty: true },
)
const child = change('Fetch user profile')
child.operation.fields = {
  ...child.operation.fields,
  folderOperation: 0,
} as typeof child.operation.fields
child.after = JSON.stringify(child.operation.fields)
add(
  'Рабочее пространство',
  'Зависимость от папки',
  'Снимите выбор папки в review: зависимую запись нельзя применить отдельно.',
  {
    workspaceProposal: {
      id: 'folder-dependency',
      summary: 'Создать папку и сниппет',
      changes: [change('API', 'code', 'folder'), child],
    },
  },
)
add(
  'Действия приложения',
  'Экспорт завершён',
  'Результат экспорта с путём сохранённого файла.',
  {
    nativeActions: [
      native(
        {
          action: 'exportView',
          view: 'codePreview',
          format: 'html',
          target: { space: 'code', id: 135 },
        },
        {
          status: 'done',
          result: {
            id: contextId,
            status: 'done',
            filePath: '/demo/export/profile.html',
          },
        },
      ),
    ],
  },
)
add(
  'Действия приложения',
  'Профиль сохранён, соединение не прошло',
  'Сохранение настроек и результат проверки соединения — разные факты.',
  {
    nativeActions: [
      native(
        { action: 'configureAi' },
        {
          status: 'done',
          result: {
            id: contextId,
            status: 'done',
            profile: {
              provider: 'openai',
              model: 'demo-model',
              saved: true,
              connectionCheck: 'failed',
            },
            reloadRequired: true,
          },
        },
      ),
    ],
  },
)
add(
  'Действия приложения',
  'Перезагрузка запрошена',
  'Подтверждение запроса перезагрузки, а не завершения запуска приложения.',
  {
    nativeActions: [
      native(
        { action: 'reload' },
        {
          status: 'done',
          result: { id: contextId, status: 'done', reloadRequested: true },
        },
      ),
    ],
  },
)
add(
  'История диалога',
  'Ссылки между сообщениями',
  'Найденные записи остаются ссылками в последующих ответах.',
  {},
  {
    conversation: {
      messages: [
        { role: 'user', content: 'Найди загрузку профиля' },
        answer({
          searchResults: [
            {
              queries: ['profile'],
              items: [items[0]],
              total: 1,
              expanded: true,
            },
          ],
          content: 'Нашёл Fetch user profile.',
        }),
        {
          role: 'user',
          content: 'Как использовать её с чеклистом?',
          attachments: [items[1]],
        },
        answer({
          content:
            'Используйте Fetch user profile вместе с API integration checklist.',
        }),
      ],
    },
  },
)
add(
  'История диалога',
  'Создание и отмена в истории',
  'После Undo ссылки отменённой записи перестают быть активными и в последующих ответах.',
  {},
  {
    conversation: {
      messages: [
        { role: 'user', content: 'Создай загрузку профиля' },
        answer({
          workspaceCreations: [
            {
              proposal: {
                ...creationProposal,
                changes: [creationProposal.changes[0]],
              },
              applied: [0],
              undone: [],
              items: [{ ...items[0], operationIndex: 0 }],
              containers: [],
            },
          ],
          taskMutations: [
            { kind: 'workspace', id: creationProposal.id, index: 0 },
          ],
        }),
        { role: 'user', content: 'Как использовать новую функцию?' },
        answer({ content: 'Вызовите Fetch user profile после авторизации.' }),
      ],
    },
  },
)

// Waiting examples include the control that can resolve that state.
const confirmation = scenarios
  .find(scenario => scenario.id === '11')!
  .conversation
  .messages
  .at(-1)!
confirmation.nativeActions = [
  native({
    action: 'setView',
    view: 'codePreview',
    target: { space: 'code', id: 135 },
  }),
]
confirmation.attachments = [items[0]]
const waitingNative = scenarios
  .find(scenario => scenario.id === '12')!
  .conversation
  .messages
  .at(-1)!
waitingNative.nativeActions = [
  native({ action: 'storage', command: 'move' }, { status: 'running' }),
]
const waitingAnswer = scenarios
  .find(scenario => scenario.id === '13')!
  .conversation
  .messages
  .at(-1)!
waitingAnswer.clarification = {
  id: 'waiting-answer',
  question: 'Какой результат вы ожидаете?',
  options: ['Краткое объяснение', 'Предложение изменений'],
}

add(
  'Действия приложения',
  'Цель без имени',
  'Запись ещё не прочитана: виден идентификатор вместо ссылки с названием.',
  {
    nativeActions: [
      native({ action: 'navigate', target: { space: 'code', id: 999 } }),
    ],
  },
)

add(
  'Ошибки',
  'Ошибка ИИ',
  'Короткое сообщение об ошибке до начала ответа. Retry запускает повтор.',
  { status: 'error' },
  { error: 'authentication' },
)
add(
  'Ошибки',
  'Ошибка после частичного ответа',
  'Полученный текст сохраняется. Длинное сообщение об ошибке проверяет переносы текста.',
  {
    status: 'error',
    content:
      'В функции не обработана ошибка сети. Начните с проверки статуса ответа…',
  },
  { error: 'invalidEdits' },
)
add(
  'Ошибки',
  'Ошибка с диагностикой',
  'Технические подробности рядом с понятным сообщением об ошибке.',
  { status: 'error' },
  {
    error: 'connection',
    diagnostic: 'DEMO: ECONNREFUSED at api.example.com:443',
  },
)
add(
  'Ошибки',
  'Повтор после ошибки',
  'Автоматически воспроизводится Retry: старая ошибка исчезает, начинается потоковый ответ. Сброс повторяет переход.',
  { status: 'error' },
  { error: 'connection', retryOnOpen: true },
)
add(
  'Ошибки',
  'Ошибка без повтора',
  'Задача уже внесла изменения: Retry недоступен, доступна отмена изменений.',
  {
    status: 'error',
    content: 'Изменение сохранено, но итоговый ответ получить не удалось.',
    edit,
    replacement,
    applied: true,
    taskMutations: [{ kind: 'editor', snapshot: edit, calls: [] }],
  },
  { error: 'connection' },
)
