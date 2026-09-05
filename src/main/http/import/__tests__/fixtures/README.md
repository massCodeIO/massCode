# HTTP import demos

These local fixtures use the existing `scripts/http-scripts-demo.mjs` server at
`http://127.0.0.1:5189`. From the repository root, run:

```sh
node scripts/http-scripts-demo.mjs
```

Use the already running massCode dev application. In HTTP, choose **Import** and
select `postman-scripts.json` or `bruno-scripts.yml` from this directory.

Each collection contains:

1. **01 Passing tests** — collection/folder/request pre-request inheritance,
   response token extraction in JS, and passing tests. Bruno also has three
   declarative assertions and a test of sandwich post-response order.
2. **02 Failing test(s)** — intentional JS failure; Bruno also fails a status assertion.
3. **03 Unsupported script** — environment/Node API outside the supported subset;
   all request scripts are blocked and originals are retained in comments.
4. **04 Malformed script** — damaged source, blocked without executing anything.

Preview must show script compatibility and warnings. Import must not grant trust.
Before trusting **01**, press **Send** and check the `untrusted` result with no
HTTP response. Inspect both scripts, then explicitly trust that request's code.
Sending it should return status 200, passing tests and a Session `token` equal to
`demo-token`. Trust **02** separately to see intentional failures. Do not trust or
remove the blocking assertion from **03/04** for this demo.

Runner has its own variables. Select only **01/02**, order **01** first, and review
individual grants before running. Source `order` becomes
`collection/folder/request`; Bruno's post-order is `request/folder/collection`.

## Primary format/semantics references

- [Postman Collection v2.1 schema](https://schema.postman.com/collection/json/v2.1.0/draft-07/collection.json)
- [Postman script execution order](https://learning.postman.com/docs/tests-and-scripts/write-scripts/intro-to-scripts/)
- [Bruno YAML scripts/assertions](https://docs.usebruno.com/opencollection-yaml/structure-reference)
- [OpenCollection schema](https://github.com/opencollection-dev/opencollection/blob/main/packages/oc-schema/src/opencollection.schema.json)
- [Bruno inherited script/test order](https://github.com/usebruno/bruno/blob/main/packages/bruno-cli/src/utils/collection.js)
- [Bruno flow export setting](https://github.com/usebruno/bruno/blob/main/packages/bruno-converters/src/opencollection/opencollection-to-bruno.ts)
- [Bruno literal assertion semantics](https://github.com/usebruno/bruno/blob/main/packages/bruno-js/src/runtime/assert-runtime.js)

The root `postman-scripts.json` and `bruno-scripts.yml` fixtures are handwritten,
synthetic scenarios, not application exports. They contain no real credentials.
Test suites additionally
cover invalid events, forbidden JavaScript, prototype access, excessive source,
recursive YAML aliases and archive expansion limits.

## Actual application exports

`exports/bruno-3.3.0.yml` and `exports/bruno-3.3.0.zip` were saved by the installed
Bruno **3.3.0** application on **2026-09-05**, using **Share → Export → Single File
(YAML)** and **Bruno Collection (ZIP)** respectively. These files are unmodified
exporter output. The collection `massCode Export Verification` was created by
importing the first two requests from the synthetic Bruno scenario above; the
scenarios are synthetic, but their serialization is from the real exporter.

Regression tests parse both exports and compare their runtime definitions with
the original scenario, then execute inherited scripts and passing/failing tests
in massCode's isolated runtime. This checks the covered subset, not every Bruno
feature. Bruno's export adds defaults and export metadata, including an empty
`value` for the `isString` assertion; all are handled by the importer.

`exports/postman-12.26.5.json` was saved by the installed Postman **12.26.5**
application on **2026-09-05**, using **More → Export collection → Export JSON**.
It is unmodified exporter output in Collection **v2.1** format. The collection
`massCode Export Verification` was created by importing the first two requests
from the synthetic Postman scenario above. Postman normalized string URLs into
objects and script source into `exec` arrays, and added export metadata and empty
response arrays.

The regression test compares imported runtime definitions with the original
scenario and executes collection/folder/request inheritance, token extraction,
passing tests and the intentional failure in massCode's isolated runtime. This
verifies the covered script subset against real export serialization; it does
not establish compatibility with every Postman API or feature.
