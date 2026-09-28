---
title: Tests & Variables
description: "Check HTTP responses with assertions and extract temporary variables for subsequent requests in massCode."
---

# Tests & Variables

<AppVersion text=">=5.11" />

Use **Assertions** for checks and **Variables → Post-response** for extraction. These declarative rules need no JavaScript. Put shared rules on a collection/folder, or request-specific rules on the request.

Use **Add assertion** or **Add extraction** at the bottom of the corresponding tab.

## Pass a Login Token to Another Request

For a login endpoint that returns `{ "token": "example-token" }`:

1. In **Variables → Post-response**, add an extraction with the variable name `token`, source **JSON body**, and path `/token`.
2. In **Assertions**, add a check named `Successful login`, source **Status code**, operator **Equals**, and expected value `200`.
3. Send the request to try the current rules. Click **Save** when you want to keep your changes.
4. In another request, use <code v-pre>{{token}}</code> in the bearer token field and send it.

## Sources and Paths

<img :src="withBase('/http-extraction.png')" alt="Successful lastOrderId extraction from the response id field">

JSON paths use JSON Pointer: `/user/id`, `/items/0/name`, or an empty path for the entire response. Escape `/` in a property name as `~1` and `~` as `~0`. Header names are case-insensitive. Extracted strings, numbers, and booleans become string variables; objects and arrays become JSON text.

For `{ "a/b": { "~id": 42 }, "items": [{ "name": "Bag" }] }`, `/a~1b/~0id` selects `42`, while `/items/0/name` selects `"Bag"`. A JSON Pointer is not a JSONPath expression: do not enter `$.items[0].name`.

Choose **Header** and a header name such as `X-Request-ID` to extract a response header. Status and duration are assertion sources only; extraction supports JSON body and headers.

## Assertion Operators

<img :src="withBase('/http-assertions.png')" alt="Status and JSON assertions with two passing results">

Assertions can check status, a JSON value, a header, or duration in milliseconds. Expected values use JSON: `200`, `true`, `null`, or a quoted string such as `"application/json"`.

| Operator | Expected value | What it checks |
| --- | --- | --- |
| Equals / Does not equal | JSON scalar, such as `200` or `"ok"` | Strict equality or inequality; strings are not converted to numbers |
| Exists | None | The selected value exists; JSON `null` counts as existing |
| Contains / Does not contain | Quoted string, such as `"json"` | Case-sensitive substring match on a string, not array membership |
| Starts with / Ends with | Quoted string, such as `"application/"` | Case-sensitive string prefix or suffix |
| Matches regex / Does not match regex | Quoted pattern, such as `"^user-[0-9]+$"` | A string matches or does not match the regular expression |
| Length equals | Non-negative integer, such as `3` | String length or number of array items |
| Greater than / Greater than or equal | Number, such as `200` | Numeric lower bound, exclusive or inclusive |
| Less than / Less than or equal | Number, such as `500` | Numeric upper bound, exclusive or inclusive |
| Between (inclusive) | Two numbers, such as `[200, 299]` | Numeric value lies within both bounds; minimum must not exceed maximum |
| In list / Not in list | Scalar array, such as `[200, 201]` | Scalar membership using exact types; up to 1000 entries |
| Is string / Is number / Is boolean | None | The selected value has that JSON type |
| Is array / Is object / Is null | None | The selected value is an array, a non-null object excluding arrays, or `null` |

Use equality/existence for exact contracts; string operators for text; numeric/range operators for status and timing; membership for allowed scalar values; and type operators when the exact value is variable.

Regex patterns use JavaScript Unicode mode, without `/` delimiters or selectable flags. Patterns are limited to 1,024 characters. If a pattern exceeds the execution limit, the check fails, including **Does not match regex**. Some emoji count as two characters in length checks.

A missing value fails any check, including negative operators. Extraction requires a non-null value. JSON rules cannot inspect binary, truncated, or invalid JSON responses. Invalid rule inputs show errors below their fields and prevent sending; a valid rule that does not match the response is reported as **Failed** after the request runs.

## Results and Session Variables

**Test Results** counts assertions, JavaScript tests, and script phase errors when scripts are present. Extraction outcomes appear in a separate group without displaying extracted values; requests with extraction alone show **Variable extraction**. Extraction runs independently of whether assertions pass. A failed check does not hide the HTTP response. A failed extraction removes an earlier Session value of the same name. For requests with scripts, a script error or failed JavaScript test discards all staged changes, including extractions and removals, so previous Session values remain. See [Execution and failure](/documentation/http/scripts#execution-and-failure).

Open the **Variables inspector** using the right-panel icon in the editor header to inspect Environment and Session separately. Session variables override environment variables with the same name; overridden environment entries are marked. Session values and environment secrets remain masked. Extracted values stay in memory and are never automatically written into environments or the vault. They can be reused across subsequent requests until replaced or cleared. See [Session Variables and Inspector](/documentation/http/environments#session-variables-and-inspector) for priority and lifecycle details. The original server response remains visible in the response viewer and may itself contain sensitive data.

## Inherited rules

Parent assertions are added to child assertions; identical names do not replace a parent check. A child extraction replaces an inherited extraction with the same variable name. The effective total, including parents, must stay within 100 assertions and 100 extractions. Shared response rules are useful only when every child response follows that contract: a `/token` extraction on an entire collection would fail requests that do not return a token.

## Limits

Each request supports up to 100 assertions and 100 extractions. Each extracted value is limited to 256 KiB of UTF-8 text; Session and Runner variables each have a 2 MiB total limit. Exceeding either limit fails extraction and discards all variable changes from that request, preserving previous values. Script writes share the same total budget. Extraction names must be unique and contain only letters `A–Z` / `a–z`, digits, underscores, dots, or hyphens; `__proto__` is reserved.

## Saving Rules

Rules and scripts are saved with the request in your vault. Renaming, moving, duplicating, trashing, and restoring requests retain them. If a request file is unavailable or its saved rules are invalid or unsupported, restore the file or correct the rules before sending.

<script setup>
import { withBase } from 'vitepress'
</script>
