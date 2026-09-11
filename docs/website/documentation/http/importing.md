---
title: Importing HTTP Collections
description: "Import OpenAPI, Postman, and Bruno collections into the massCode HTTP space."
---

# Importing Collections

Use import when you already have API collections or specifications in another tool and want to bring them into the HTTP space without recreating requests by hand.

## Supported Formats

HTTP import supports:

- **OpenAPI JSON/YAML** - generates requests from OpenAPI operations.
- **Postman Collection v2.1 JSON** - imports folders, requests, params, headers, bodies, descriptions, and supported auth.
- **Postman Environment JSON** - optional environment file imported together with a Postman collection.
- **Bruno OpenCollection YAML** - imports single-file Bruno OpenCollection exports.
- **Bruno OpenCollection ZIP** - imports zipped Bruno OpenCollection exports.

## Moving from Postman or Bruno

Start with one collection and verify a complete request flow before importing the rest.

| Source | What to bring | What to review |
| --- | --- | --- |
| Postman | Collection v2.1 JSON and, optionally, an environment JSON | Collection/folder variables, auth, and scripts remain in their original scopes. None, inherited, Basic, Bearer, and API Key auth are supported. GraphQL and binary bodies are supported; review warnings for unsupported features. |
| Bruno | OpenCollection YAML or an OpenCollection ZIP export | Native `.bru` files are not an import format. Review inherited auth: configure it on each request after import. API key auth is converted to a header or query entry. |
| OpenAPI | A JSON or YAML specification | Generated requests are a starting point. Review the server URL, authentication, and example values before sending. |

massCode uses one active environment at a time. For Postman, collection/folder variables remain defaults beneath the selected environment and Session. Bruno bundled collection variables may instead become a separate `<Collection> Variables` environment; combine any values you need with the environment you plan to select. Check the Variables inspector after import.

Supported scripts and Bruno assertions are converted into massCode rules and the `mc` scripting API. Review the compatibility details below before running an imported workflow.

### Export from the Source App

- **Postman:** open the collection menu, choose **More → Export collection → Export JSON**, and select the resulting Collection v2.1 JSON in massCode. Export an environment separately if the requests need one.
- **Bruno:** open the collection menu and choose **Share → Export**. Use **Single File (YAML)** or a **Bruno Collection (ZIP)** containing OpenCollection YAML files. Archives containing native `.bru` files are not supported.

## Opening Import

Open **HTTP**, click **+** at the top of the sidebar, and choose **Import**. You can also use the HTTP import action in the command palette.

## Selecting Files

Use either method in the import dialog:

- Click **Choose files** and select one or more files from disk.
- Drag files into the drop zone.

For Postman, select the collection JSON and, optionally, the environment JSON in the same import dialog.

## Preview

After files are selected, massCode reads them and shows a preview before anything is written to your vault.

The preview includes:

- number of collections
- number of requests
- number of environments
- collection names with folder and request counts
- environment names with variable counts
- assertion counts and script compatibility for each request
- warnings for skipped or unsupported features

Click **Import** to create the previewed items in the HTTP space.


## Where Imported Data Goes

Each imported collection becomes a new top-level folder in the HTTP space. Nested folders and requests are created under that collection folder.

Imported environments are added to the **Environments** panel. Environment variables are stored as plain text in your vault, the same as variables created manually in HTTP.

::: warning
Review imported requests and environments before committing or sharing your vault. Imported auth values, headers, params, bodies, and environment variables may contain credentials from the source collection.
:::

## Request-format compatibility

Postman preserves supported query/header rows and descriptions, raw JSON/text, URL-encoded forms, multipart text/file entries, GraphQL query/variables/operation selection, and binary file references. Files are referenced by path, not bundled: reselect them on the current device. Unsupported auth and malformed bodies produce warnings rather than a promise of equivalent execution.

Bruno OpenCollection is a distinct format. API key auth becomes a header or query row, inherited auth needs review, and a GraphQL body imports as JSON with a warning. Native `.bru` files are not parsed.

### OpenAPI-generated requests

Import uses operations to generate requests and groups them into a collection. It chooses the applicable server URL, parameter examples/defaults, and a supported request-body representation. Supported security definitions become auth or header/query entries and variable placeholders. Resolve placeholders and supply credentials before sending.

Only local document references are resolved; external `$ref` documents are not fetched. Generation is not a complete schema-driven API explorer: review server variables, alternative servers/security requirements, required fields, and example payloads. Unsupported security schemes are reported. Keep the original specification as your API contract.

## Scripts and Tests

<AppVersion text=">=5.11" />

Import converts a limited, explicit subset of JavaScript into the [massCode `mc` API](/documentation/http/scripts). It reads the source syntax without executing it. Original `pm` and `bru` APIs are not available in the massCode runtime.

| Source feature | Supported conversion |
| --- | --- |
| Postman events | Inline `prerequest` and `test` JavaScript events. `exec` can be a string or an array of lines. Disabled events are skipped with a warning. |
| Bruno scripts | OpenCollection `before-request`, `after-response`, and `tests` scripts. |
| Test callbacks | Synchronous `pm.test(name, callback)` / `test(name, callback)` with a literal name and a parameterless block callback. |
| Expectations | `pm.expect(...)` / `expect(...)` with `equal`, `equals`, `eq`, literal `true`, `false`, `null`, or `undefined`; `not` is supported for these checks. Numeric `above`, `greaterThan`, `below`, `lessThan`, `least`, and `most` are supported without `not`. |
| Response data | Postman `pm.response.code`, `responseTime`, `json()`, `text()`; Bruno `res.status`, `res.responseTime`, `res.body`. Static property/index access is supported. JSON reads require a complete, non-binary response. |
| Temporary variables | `pm.variables.get/set/unset` and `bru.getVar/setVar/deleteVar`, using literal variable names. Values written to massCode must be strings; use `String(value)` when appropriate. |
| Scoped reads and diagnostics | Postman `pm.environment.get()` and `pm.collectionVariables.get()` with literal names; supported `console.log/info/warn/error/clear` calls. |
| Local JavaScript | `const` declarations, scalar literals, static property access, comparisons, arithmetic, boolean expressions, `typeof`, and `String(value)`. |

Temporary variables use manual Session for **Send** and isolated variables for **Folder Runner**. Reads also see the selected massCode environment. Postman collection/folder scopes are preserved. Supported `pm.environment.get()` and `pm.collectionVariables.get()` reads retain their respective scope through `mc.environment.get()` and `mc.collectionVariables.get()`. Request-level and global variable scopes are not recreated; review scope warnings. Writes to Postman Environment/Collection/Globals or Bruno Env/GlobalEnv are unsupported and block script conversion. Postman request-level variable declarations and Bruno scoped variables/runtime actions require manual adaptation.

### Inherited scripts

Postman collection/folder scripts stay on their corresponding collection/folder; request scripts stay on the request. Editing a shared Postman scope updates its descendants. Bruno inherited scripts are converted into each request, so later folder edits do not update those imported copies.

Postman pre-request and post-response events run from collection to parent folders to request. Bruno pre-request scripts run in that same order. Its default **sandwich** flow runs post-response scripts and tests from request back through folders to collection. The **sequential** flow runs them from collection to request. Import reads the Bruno flow setting from the collection export. Bruno tests follow all post-response scripts.

Inherited JavaScript that depends on shared lexical bindings between script blocks is unsupported. Use supported temporary variables to pass values between stages and requests.

### Bruno assertions

Static response expressions such as `res.status`, `res.responseTime`, `res.headers["content-type"]`, and `res.body.user.id` become local assertion sources. Static array indices and quoted property names are supported.

Supported operators: `eq`, numeric `gt` / `gte` / `lt` / `lte`, `isString`, `isNumber`, `isBoolean`, `isArray`, and `isNull`. `neq` is supported for status and duration only: missing JSON properties and headers have different semantics in the two tools. Expected values must be literal strings, finite numbers, booleans, or `null`; variable interpolation and executable expressions are not converted. Unsupported and disabled assertions produce warnings.

massCode evaluates declarative rules before post-response JavaScript. Bruno evaluates them after post-response scripts. Converted scripts cannot modify the response or access assertion results, so supported checks continue to inspect the received response. Recreate response extraction actions in **Variables → Post-response**, or use supported script statements to store a string value.

### Unsupported or damaged code

An unsupported or malformed active script blocks execution of requests that depend on it. Original code is retained as JSON-encoded comments in **Pre-request**, preceded by a blocking assertion. For Postman, open **Scripts** on the collection, folder, or request identified by the import warning: the retained original and blocker live in that same scope. A request can therefore be blocked by a parent even when its own script looks valid. Bruno inherited code is flattened into the request, so review its request-level Scripts. Rewrite the code using the `mc` API before removing the blocker. Granting trust alone does not make a blocked import executable.

Unsupported features include async callbacks, promises, timers, loops, functions outside test callbacks, dynamic API access, arbitrary library calls, deep Chai assertions, request/response mutation, external packages, filesystem access, additional HTTP requests, and Runner control. A duplicate Bruno script stage also requires adaptation.

Keep the original collection file. Scripts that exceed the storage limit cannot be retained in full; preview warns when this happens. Unsupported declarative rules are reported but not saved as executable rules.

::: warning Review and trust
No imported code runs during preview or import, and trust is never imported. Review both scripts, verify the request destination and environment, then use **Trust this code** locally. Importing the same collection again creates new requests that require their own trust. The existing script time, memory and output limits still apply.

Scripts, request definitions and environment values may contain credentials. Original code retained in comments is also stored as plain text in your vault.
:::

## Import Limits

Import up to 1,000 requests from up to 1,000 files, with up to 2 MiB per JSON/YAML file and a 16 MiB total input budget. Archives also have a 16 MiB expanded budget. Excessive nesting, recursive YAML aliases and damaged input are rejected. Each request supports at most 100 imported assertions, 100 inherited script blocks and a 64,000-character source budget, within the local limit of 64 KiB per phase; unsupported or excess rules are reported in preview.

HTTP currently provides collection import, not a collection export workflow. Importing again creates another collection; it does not synchronize with or update the source tool.

## Warnings

Preview reports skipped rules/events, script adaptation requirements, variable-scope differences, disabled environment variables and unsupported authentication. Review every warning: a successful import confirms that items were created, not that the original workflow is fully compatible.

## Verify an Imported Collection

1. Select the imported environment. Check the base URL and required variables, and store credentials as [secret variables](/documentation/http/environments#secret-variables).
2. Open a request and inspect **Auth**, **Headers**, **Params**, and **Body**. Set any skipped authentication manually. For API keys, check the Auth placement or the header/query row produced by Bruno import. Reselect multipart files from this device if their original paths are unavailable.
3. Inspect imported **Assertions** and **Scripts**. Recreate skipped rules and response extraction with [Tests & Variables](/documentation/http/tests).
4. Adapt any blocked scripts using the [massCode `mc` API](/documentation/http/scripts), review both phases and explicitly trust the code. Send one request and inspect its response and **Test Results** before running the complete workflow.
5. Save the requests, open [Folder Runner](/documentation/http/runner), and review their order. Put authentication and other setup requests before requests that depend on their results. The runner begins with empty temporary variables, so a token from a previous manual Send is not available to it.
