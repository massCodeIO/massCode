---
title: Folder Runner
description: "Run saved HTTP requests in sequence, pass variables between steps, and inspect failures in massCode."
---

# Folder Runner

<AppVersion text=">=5.11" />

Right-click an HTTP folder and choose **Runner** to run its saved requests, including nested folders, in sequence. A top-level collection can be run the same way. This is a sequential workflow runner, not a load generator or a scheduled monitor.

## Prepare and Run

If the workflow contains [JavaScript scripts](/documentation/http/scripts), review and trust the code in every applicable request, folder, and collection scope before opening the runner. The runner executes saved pre-request and post-response scripts; an untrusted step fails before sending.

1. Save or discard any changes in the current request when prompted. Cancelling keeps the editor open without preparing a run.
2. Review the prepared list and environment. Drag anywhere on a request row to change the order for this run only. Reordering is disabled during execution.
3. Leave **Continue on failure** unchecked to stop at the first failed step, or enable it to run the remaining steps after failures.
4. Click **Run**. Each step shows its HTTP status, duration, assertion results, extraction results, and JavaScript tests or script phase errors.

The initial order is oldest-created requests first within each folder, followed by its child folders in sidebar order. Changing the run order does not reorder requests in the library. WebSocket entries are excluded. A run supports up to 500 HTTP requests. Folders without HTTP requests, unavailable requests, and invalid or unsupported rules prevent preparation before any request is sent.

The runner snapshots saved requests and the active environment when you open it. Later edits do not change that prepared run. Choose **Prepare new run** after completion to load the latest saved data.

<img :src="withBase('/http-runner.png')" alt="Checkout runner with all three requests passing">

For an API workflow, put `Login` first, extract its token, then run `Create item` and extract its ID before `Read item`. To run a smaller workflow, organize its requests into a dedicated folder.

## Variables and Failures

Each run starts with an empty temporary variable scope over the selected environment. Successful **Variables → Post-response** extractions make values available to subsequent steps through <code v-pre>{{name}}</code>, overriding environment variables with the same name. Failed extractions remove the previous run value for that name. Extraction runs independently of assertion results. For requests with scripts, these changes are committed only if both script phases succeed; a script error or failed JavaScript test discards all staged changes and keeps the previous run values. See [Execution and failure](/documentation/http/scripts#execution-and-failure).

Manual **Session** values are not read or changed by the runner. Run variables are discarded at the end and are not shown in the Variables inspector.

A network error, HTTP status of 400 or higher, failed assertion, failed extraction, script error, or failed JavaScript test marks a step as failed. GraphQL errors, invalid envelopes, and truncated GraphQL responses also fail a step even with HTTP 200. When stopping on failure, the remaining steps are marked as skipped.

## Stop a Run

**Stop run** aborts the active request and skips remaining steps. Closing the runner, reloading the app, switching vault or environment, or clearing the manual Session also cancels an active run. Cancellation cannot undo a request already received by the server.

The consolidated run results remain available only while the runner is open. Executed requests also write [history entries and redacted snapshots](./responses#request-history) under the configured retention policy. Temporary run variables are not written into the environment or vault.

<script setup>
import { withBase } from 'vitepress'
</script>
