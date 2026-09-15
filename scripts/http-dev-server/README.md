# Локальный HTTP-сервер для разработки

Синтетические loopback-серверы для Computer QA пространства HTTP. Не используют
vault, внешние сервисы, рабочие данные, TLS или HTTP/2. Задержки и интервалы сервера
управляют тестовым сценарием — это **не измерения производительности приложения**.
Для оценки производительности используйте изолированный benchmark vault. Профили
собирайте отдельными запусками, чтобы профилирование не влияло на замеры времени.

## Запуск

```sh
pnpm http:server
pnpm http:server --help
pnpm http:server -- --transport-port 0 --cross-origin-port 0
```

Все сервисы слушают `127.0.0.1`. Флаги принимают целое число от `0` до `65535`;
`0` выбирает свободный порт автоматически. После готовности всех слушателей stdout
выводит одну JSON-строку:

```json
{ "event": "ready", "addresses": { "websocket": "ws://127.0.0.1:5188", "scripts": "http://127.0.0.1:5189", "showcase": "http://127.0.0.1:5190", "graphql": "http://127.0.0.1:4399", "transport": "http://127.0.0.1:5191", "crossOrigin": "http://127.0.0.1:5192" } }
```

Адреса содержат реальные порты, включая автоматически выбранные. При ошибке запуска
сервер закрывает уже открытые слушатели и завершается с ненулевым кодом. SIGINT /
SIGTERM закрывают HTTP-соединения, активные WebSocket и таймеры; текущие запросы могут
быть прерваны. Ошибки конфигурации выводятся в stderr. Импорт модулей не запускает
слушатели: в тестах можно вызвать `startServers(ports)` и затем дождаться `close()`.

| Сервис | Порт | Флаг | Авторизация |
| --- | --- | --- | --- |
| WebSocket | 5188 | `--websocket-port` | `/protected`: bearer `demo-token`, `X-Client-ID`, непустой query-параметр `channel` |
| Scripts | 5189 | `--scripts-port` | Не требуется |
| Showcase | 5190 | `--showcase-port` | Bearer `demo-commerce-token` для commerce-данных |
| GraphQL | 4399 | `--graphql-port` | Bearer `graphql-demo` |
| Transport | 5191 | `--transport-port` | Не требуется |
| Второй HTTP origin | 5192 | `--cross-origin-port` | Не требуется |

Токены — публичные тестовые значения. Все сервисы запускаются одной командой
`pnpm http:server` на указанных выше портах.

## Сохранённые сценарии

- **Scripts:** `/health` возвращает `{"demo":"masscode-http-scripts"}`.
  Остальные запросы возвращают `{"token":"demo-token","received":"<исходное тело>"}`.
  Тело длиннее 65 536 JavaScript-символов получает 413.
- **WebSocket:** `/` повторяет текстовые и бинарные сообщения. `/protected`
  сначала отправляет `{type:"connected", authenticated:true, channel, clientId}`,
  затем повторяет сообщения. Неверный bearer-токен получает 401; отсутствие channel
  или client ID — 400; неизвестный путь — 404. Обычный HTTP получает 426.
  Максимальное сообщение: 1 MiB.
- **GraphQL:** `POST /graphql` с JSON `{query, variables?, operationName?}`.
  Поля Query: `hello` (`Hello GraphQL`), `token` (`graphql-demo`), `user(id: ID!)`
  (имя по умолчанию `Ada`), `broken` (ошибка поля с кодом `DEMO_ERROR`).
  Мутация `rename(id: ID!, name: String!)` сохраняет имя в текущем экземпляре.
  Неверная авторизация получает 401, неправильные метод/путь — 404, некорректный JSON
  или тело длиннее 1 000 000 JavaScript-символов — 400. Ошибки исполнения GraphQL
  остаются ответами GraphQL со статусом 200.
- **Showcase:** необязательный префикс `/v1`. Публичные маршруты: `/health`,
  `/metrics`, `/status/maintenance` (503), `POST /auth/token`. Защищённые:
  `/products` (фильтр `category`), `/products/:id`, `/customers`, `/customers/:id`,
  `/orders`, `/orders/:id`. `POST /orders` принимает
  `{customerId, items:[{productId, quantity}]}` и использует первый товар;
  некорректные данные получают 422. `POST /orders/:id/fulfillment` переводит заказ
  в статус shipped. Исходный заказ — `ord_1042`, первый новый — `ord_1043`.
  Товары: `prd_weekender`, `prd_bottle`, `prd_tote`; покупатели: `cus_2048`,
  `cus_2049`. Ограничение JSON-тела: 65 536 JavaScript-символов (413).
  Некорректный JSON получает 400. Сохранены исходные данные, фиксированные заголовки
  request ID, rate limit и no-store.

## Контракт Transport

Основной и второй слушатели предоставляют одинаковые маршруты. `/cross-origin`
указывает на реальный `/echo` соседнего слушателя. Произвольного адреса перенаправления
нет. Разные порты позволяют проверить смену HTTP origin; cookies привязаны к хосту
и не изолируются портом. Политика браузерного CORS не добавляется.

| Маршрут | Поведение |
| --- | --- |
| GET/HEAD/POST/PUT/PATCH/DELETE/OPTIONS `/echo` | JSON `{method, query, headers, body}`. `query` — упорядоченный массив пар `[key,value]` с сохранением повторов. Заголовки нормализованы Node; тело декодируется как UTF-8. Ограничение тела — 1 MiB, затем 413. HEAD возвращает только заголовки по правилам HTTP. |
| GET `/status/:code` | Целое 200–599; JSON `{status:code}`. Статусы 204, 205 и 304 возвращаются без тела. |
| GET `/delay/:ms` | Целое 0–10 000; после задержки JSON `{delay:ms}`. Отключение клиента отменяет таймер. |
| GET `/bytes/:size` | Целое 0–16 777 216; ровно столько ASCII-байтов `x`, octet-stream с Content-Length. |
| GET `/stream?chunks=4&size=1024&interval=10` | Показаны значения по умолчанию. `chunks`: 1–100; `size`: 1–65 536 байтов; `interval`: 0–1000 мс. Всего ≤16 MiB и `(chunks-1)*interval` ≤10 000 мс. Первый фрагмент отправляется сразу, следующие — с интервалом после записи/освобождения буфера. Фрагмент `i` повторяет ASCII `a + (i modulo 26)`. TCP/HTTP-клиент может объединять или разделять записи. Сервер учитывает backpressure и отменяет таймеры при отключении. |
| GET/HEAD/POST/PUT/PATCH/DELETE/OPTIONS `/redirect/:code` | Коды 301, 302, 303, 307, 308; пустое тело и Location `/echo`. Повтор метода/тела POST определяется клиентом и статусом. |
| GET/HEAD/POST/PUT/PATCH/DELETE/OPTIONS `/chain/:count` | Целое 0–20. Положительное число даёт 302 на `/chain/:count-1`; ноль — JSON `{remaining:0}`. |
| GET/HEAD/POST/PUT/PATCH/DELETE/OPTIONS `/loop` | Всегда 302 на `/loop`; ограничьте число редиректов в клиенте или отключите переходы. |
| GET/HEAD/POST/PUT/PATCH/DELETE/OPTIONS `/cross-origin` | 302 на абсолютный URL `/echo` второго слушателя. |
| GET `/cookies-set` | Устанавливает `demo=masscode; Path=/; HttpOnly; SameSite=Lax` и `theme=dark; Path=/; SameSite=Lax`; JSON `{set:true}`. |
| GET `/cookies-echo` | JSON `{cookie:"<исходный заголовок Cookie или пустая строка>"}`. |
| POST `/reset` | Сбрасывает GraphQL users, showcase orders и нумерацию текущей группы; JSON `{reset:true}`. |

Числовые параметры содержат только десятичные цифры. Отсутствующие, отрицательные,
дробные, нечисловые и выходящие за границы значения получают 400 с JSON `{error}`.
Неподдерживаемые методы получают 405, неизвестные GET-маршруты — 404. Echo и редиректы
принимают обычные HTTP-методы GET, HEAD, POST, PUT, PATCH, DELETE и OPTIONS. Заголовки запроса вроде
`host` и `connection` закономерно зависят от клиента.

Вызывайте `/reset`, когда запросы завершены. Сброс не отменяет текущие запросы:
параллельная мутация может исполниться после сброса и снова изменить состояние.
Разные вызовы `startServers()` полностью разделяют изменяемое состояние.

## Проверки

```sh
pnpm test scripts/http-dev-server
pnpm exec eslint scripts/http-dev-server scripts/http-graphql-fixtures.mjs
```
