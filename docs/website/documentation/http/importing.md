---
title: Importing HTTP Collections
description: "Import OpenAPI, Postman, and Bruno collections into the massCode HTTP space."
---

# Importing Collections

Use import when you already have API collections or specifications in another tool and want to bring them into the HTTP space without recreating requests by hand.

<img :src="withBase('/http-import.png')">

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
| Postman | Collection v2.1 JSON and, optionally, an environment JSON | Collection variables become a separate environment named `<Collection> Variables`. Basic and bearer auth inherited from a collection or folder are copied into individual requests. Other auth types are skipped. |
| Bruno | OpenCollection YAML or an OpenCollection ZIP export | Native `.bru` files are not an import format. Review inherited auth: configure it on each request after import. API key auth is converted to a header or query entry. |
| OpenAPI | A JSON or YAML specification | Generated requests are a starting point. Review the server URL, authentication, and example values before sending. |

massCode uses one active environment at a time. Imported collection variables and a separately imported environment are not automatically layered together. Copy any shared base URLs or IDs into the environment you plan to use, and check unresolved placeholders in the request preview.

Supported scripts and Bruno assertions are converted into massCode rules and the `mc` scripting API. Review the compatibility details below before running an imported workflow.

### Export from the Source App

- **Postman:** open the collection menu, choose **More → Export collection → Export JSON**, and select the resulting Collection v2.1 JSON in massCode. Export an environment separately if the requests need one.
- **Bruno:** open the collection menu and choose **Share → Export**. Use **Single File (YAML)** or a **Bruno Collection (ZIP)** containing OpenCollection YAML files. Archives containing native `.bru` files are not supported.

These export paths have been verified with Postman **12.26.5** and Bruno **3.3.0**, including collection/folder/request scripts and passing and failing JavaScript tests; the Bruno examples also include declarative assertions. Compatibility covers the subset described below, so review import warnings even when using these versions.

## Opening Import

Open the **HTTP** space and click the import button in the HTTP sidebar header. The import button is next to the **HTTP Client** title because importing can create folders, requests, and environments.

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
| Local JavaScript | `const` declarations, scalar literals, static property access, comparisons, arithmetic, boolean expressions, `typeof`, and `String(value)`. |

Temporary variables use manual Session for **Send** and isolated variables for **Folder Runner**. Reads also see the selected massCode environment. Source collection, folder, request, global and persistent environment scopes are not recreated. An import warning identifies this difference. Writes to Postman Environment/Collection/Globals or Bruno Env/GlobalEnv are unsupported and block script conversion. Request/folder variable declarations and Bruno runtime actions also require manual adaptation.

### Inherited scripts

Collection and folder scripts are copied into each imported request. Editing an imported folder does not update those copies.

Postman pre-request and post-response events run from collection to parent folders to request. Bruno pre-request scripts run in that same order. Its default **sandwich** flow runs post-response scripts and tests from request back through folders to collection. The **sequential** flow runs them from collection to request. Import reads the Bruno flow setting from the collection export. Bruno tests follow all post-response scripts.

Inherited JavaScript that depends on shared lexical bindings between script blocks is unsupported. Use supported temporary variables to pass values between stages and requests.

### Bruno assertions

Static response expressions such as `res.status`, `res.responseTime`, `res.headers["content-type"]`, and `res.body.user.id` become local assertion sources. Static array indices and quoted property names are supported.

Supported operators: `eq`, numeric `gt` / `gte` / `lt` / `lte`, `isString`, `isNumber`, `isBoolean`, `isArray`, and `isNull`. `neq` is supported for status and duration only: missing JSON properties and headers have different semantics in the two tools. Expected values must be literal strings, finite numbers, booleans, or `null`; variable interpolation and executable expressions are not converted. Unsupported and disabled assertions produce warnings.

massCode evaluates declarative rules before post-response JavaScript. Bruno evaluates them after post-response scripts. Converted scripts cannot modify the response or access assertion results, so supported checks continue to inspect the received response. Recreate response extraction actions in **Variables → Post-response**, or use supported script statements to store a string value.

### Unsupported or damaged code

If any active script for a request is unsupported or malformed, **all scripts for that request are blocked**, including inherited scripts. Their original code is retained as JSON-encoded comments in the pre-request editor, preceded by a blocking assertion. Review and rewrite the code using the `mc` API before removing that assertion. Granting trust alone does not make a blocked import executable.

Unsupported features include async callbacks, promises, timers, loops, functions outside test callbacks, dynamic API access, arbitrary library calls, deep Chai assertions, request/response mutation, external packages, filesystem access, additional HTTP requests, and Runner control. A duplicate Bruno script stage also requires adaptation.

Keep the original collection file. Scripts that exceed the storage limit cannot be retained in full; preview warns when this happens. Unsupported declarative rules are reported but not saved as executable rules.

::: warning Review and trust
No imported code runs during preview or import, and trust is never imported. Review both scripts, verify the request destination and environment, then use **Trust this code** locally. Importing the same collection again creates new requests that require their own trust. The existing script time, memory and output limits still apply.

Scripts, request definitions and environment values may contain credentials. Original code retained in comments is also stored as plain text in your vault.
:::

## Import Limits

Import up to 1,000 requests from up to 1,000 files, with up to 2 MiB per JSON/YAML file and a 16 MiB total input budget. Archives also have a 16 MiB expanded budget. Excessive nesting, recursive YAML aliases and damaged input are rejected. Each request supports at most 100 imported assertions, 100 inherited script blocks and a 64,000-character source budget, within the local limit of 64 KiB per phase; unsupported or excess rules are reported in preview.

## Warnings

Preview reports skipped rules/events, script adaptation requirements, variable-scope differences, disabled environment variables and unsupported authentication. Review every warning: a successful import confirms that items were created, not that the original workflow is fully compatible.

## Verify an Imported Collection

1. Select the imported environment. Check the base URL and required variables, and store credentials as [secret variables](/documentation/http/environments#secret-variables).
2. Open a request and inspect **Auth**, **Headers**, **Params**, and **Body**. Set any skipped authentication manually. For API keys, add the header or query parameter expected by your API. Reselect multipart files from this device if their original paths are unavailable.
3. Inspect imported **Assertions** and **Scripts**. Recreate skipped rules and response extraction with [Tests & Variables](/documentation/http/tests).
4. Adapt any blocked scripts using the [massCode `mc` API](/documentation/http/scripts), review both phases and explicitly trust the code. Send one request and inspect its response and **Test Results** before running the complete workflow.
5. Save the requests, open [Folder Runner](/documentation/http/runner), and review their order. Put authentication and other setup requests before requests that depend on their results. The runner begins with empty temporary variables, so a token from a previous manual Send is not available to it.

A successful import confirms that items were created. Check the results of the complete flow to confirm that it behaves as intended. Importing again creates new items rather than updating the collection you already imported.

<script setup>
import { withBase } from 'vitepress'
</script>
