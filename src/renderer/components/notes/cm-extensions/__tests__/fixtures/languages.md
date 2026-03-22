# Code Highlight Demo

Syntax highlighting demo for fenced code blocks.

## JavaScript

```js
const API_URL = 'https://api.example.com'

async function fetchUsers(page = 1) {
  const res = await fetch(`${API_URL}/users?page=${page}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

const active = users.filter(u => u.isActive && u.roles.length > 0)
```

## TypeScript

```ts
interface Config {
  host: string
  port: number
  debug?: boolean
}

type Handler<T> = (req: Request, ctx: T) => Promise<Response>

function createServer<T extends Config>(config: T): void {
  const { host, port, debug = false } = config
  console.log(`Starting on ${host}:${port}`)
}
```

## Python

```python
from dataclasses import dataclass
from typing import Optional

@dataclass
class Task:
    title: str
    done: bool = False
    priority: Optional[int] = None

def filter_pending(tasks: list[Task]) -> list[Task]:
    """Return tasks that are not yet completed."""
    return [t for t in tasks if not t.done]
```

## Rust

```rust
use std::collections::HashMap;

fn word_count(text: &str) -> HashMap<&str, usize> {
    let mut counts = HashMap::new();
    for word in text.split_whitespace() {
        *counts.entry(word).or_insert(0) += 1;
    }
    counts
}
```

## Go

```go
package main

import "fmt"

type Greeting struct {
	Name    string
	Message string
}

func (g Greeting) String() string {
	return fmt.Sprintf("%s: %s", g.Name, g.Message)
}
```

## C

```c
#include <stdio.h>
#include <stdlib.h>

typedef struct {
    int x, y;
} Point;

Point* create_point(int x, int y) {
    Point* p = malloc(sizeof(Point));
    if (p) { p->x = x; p->y = y; }
    return p;
}
```

## C++

```cpp
#include <vector>
#include <algorithm>

template<typename T>
T median(std::vector<T> v) {
    std::sort(v.begin(), v.end());
    auto n = v.size();
    return n % 2 ? v[n / 2] : (v[n / 2 - 1] + v[n / 2]) / 2;
}
```

## Java

```java
import java.util.List;
import java.util.stream.Collectors;

public record User(String name, int age, String dept) {}

var byDept = users.stream()
    .collect(Collectors.groupingBy(User::dept, Collectors.counting()));
byDept.forEach((d, c) -> System.out.printf("%s: %d%n", d, c));
```

## C#

```csharp
public record Product(string Name, decimal Price, int Stock);

public static IEnumerable<Product> InStock(IEnumerable<Product> products)
    => products.Where(p => p.Stock > 0).OrderBy(p => p.Price);

public static decimal TotalValue(IEnumerable<Product> products)
    => products.Sum(p => p.Price * p.Stock);
```

## Kotlin

```kotlin
data class Point(val x: Double, val y: Double) {
    fun distanceTo(other: Point): Double {
        val dx = x - other.x
        val dy = y - other.y
        return kotlin.math.sqrt(dx * dx + dy * dy)
    }
}
```

## Swift

```swift
struct Temperature {
    var celsius: Double
    var fahrenheit: Double { celsius * 9 / 5 + 32 }
    var description: String {
        String(format: "%.1f°C (%.1f°F)", celsius, fahrenheit)
    }
}
```

## Ruby

```ruby
class FileProcessor
  attr_reader :path, :lines

  def initialize(path)
    @path = path
    @lines = File.readlines(path, chomp: true)
  end

  def word_count
    lines.sum { |line| line.split.size }
  end
end
```

## PHP

```php
<?php
class UserRepository {
    public function __construct(private readonly PDO $db) {}

    public function findByEmail(string $email): ?array {
        $stmt = $this->db->prepare('SELECT * FROM users WHERE email = :email');
        $stmt->execute(['email' => $email]);
        return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
    }
}
```

## Dart

```dart
class Logger {
  final String prefix;
  Logger(this.prefix);

  void info(String msg) => print('[$prefix INFO] $msg');
  void error(String msg) => print('[$prefix ERROR] $msg');
}
```

## Scala

```scala
case class Item(name: String, price: Double, qty: Int)

object Cart {
  def total(items: List[Item]): Double =
    items.map(i => i.price * i.qty).sum
}
```

## Lua

```lua
local function memoize(fn)
  local cache = {}
  return function(...)
    local key = table.concat({...}, ",")
    if cache[key] == nil then
      cache[key] = fn(...)
    end
    return cache[key]
  end
end
```

## Perl

```perl
use strict;
use warnings;

my %ext_count;
find(sub {
    return unless -f;
    my ($ext) = $_ =~ /\.(\w+)$/;
    $ext_count{lc $ext}++ if $ext;
}, '.');
```

## Haskell

```haskell
wordFreq :: String -> [(String, Int)]
wordFreq = sortBy (flip compare `on` snd)
         . map (\ws -> (head ws, length ws))
         . group . sort . words
```

## Erlang

```erlang
-module(counter).
-export([start/0, increment/1]).

start() -> spawn(fun() -> loop(0) end).

increment(Pid) ->
    Pid ! {increment, self()},
    receive {ok, Val} -> Val end.
```

## Clojure

```clojure
(defn word-frequencies [text]
  (->> (clojure.string/split text #"\s+")
       (map clojure.string/lower-case)
       (frequencies)
       (sort-by val >)))
```

## R

```r
analyze <- function(data, column) {
  list(
    mean   = mean(data[[column]], na.rm = TRUE),
    median = median(data[[column]], na.rm = TRUE),
    sd     = sd(data[[column]], na.rm = TRUE)
  )
}
```

## HTML

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Demo</title>
</head>
<body>
  <main id="app">
    <h1 class="title">Hello World</h1>
    <button onclick="alert('clicked')">Click me</button>
  </main>
</body>
</html>
```

## CSS

```css
:root {
  --primary: oklch(50% 0.19 260);
}

.card {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
  border-radius: var(--radius);
}

.card:hover {
  box-shadow: 0 4px 12px oklch(0% 0 0 / 0.1);
}
```

## SCSS

```scss
$breakpoints: (sm: 640px, md: 768px, lg: 1024px);

@mixin respond-to($name) {
  @if map-has-key($breakpoints, $name) {
    @media (min-width: map-get($breakpoints, $name)) { @content; }
  }
}
```

## SQL

```sql
SELECT u.id, u.name, COUNT(o.id) AS order_count
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
WHERE u.created_at >= '2024-01-01'
GROUP BY u.id, u.name
HAVING COUNT(o.id) > 0
ORDER BY order_count DESC
LIMIT 10;
```

## Shell

```bash
#!/bin/bash
set -euo pipefail

BACKUP_DIR="/var/backups/$(date +%Y%m%d)"
mkdir -p "$BACKUP_DIR"

for db in $(psql -lt | awk '{print $1}'); do
  pg_dump "$db" | gzip > "$BACKUP_DIR/${db}.sql.gz"
done
```

## PowerShell

```powershell
function Get-LargeFiles {
    param([string]$Path = ".", [int]$MinSizeMB = 100)
    Get-ChildItem -Path $Path -Recurse -File |
        Where-Object { $_.Length -gt ($MinSizeMB * 1MB) } |
        Sort-Object Length -Descending |
        Select-Object FullName, @{N='SizeMB'; E={[math]::Round($_.Length/1MB,2)}}
}
```

## JSON

```json
{
  "name": "masscode",
  "version": "4.7.1",
  "dependencies": {
    "vue": "^3.5.0",
    "better-sqlite3": "^11.0.0"
  }
}
```

## YAML

```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
```

## TOML

```toml
[package]
name = "my-app"
version = "0.1.0"
edition = "2021"

[dependencies]
serde = { version = "1.0", features = ["derive"] }
tokio = { version = "1", features = ["full"] }
```

## XML

```xml
<?xml version="1.0" encoding="UTF-8"?>
<catalog>
  <book id="bk101">
    <author>Gambardella, Matthew</author>
    <title>XML Developer's Guide</title>
    <price>44.95</price>
  </book>
</catalog>
```

## Dockerfile

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:22-alpine
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

## Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name example.com;

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
    }

    location / {
        root /var/www/html;
        try_files $uri /index.html;
    }
}
```

## Vue

```vue
<script setup lang="ts">
import { useCounter } from '@/composables'

const { count, increment } = useCounter()
const doubled = computed(() => count.value * 2)
</script>

<template>
  <div class="counter">
    <span>{{ count }} (× 2 = {{ doubled }})</span>
    <button @click="increment">+</button>
  </div>
</template>
```

## Markdown

```markdown
# Project

A brief description.

## Features

- **Fast** — optimized
- **Simple** — minimal config
- [Docs](https://example.com)
```

## LaTeX

```latex
\documentclass{article}
\usepackage{amsmath}

\begin{document}
The roots of $ax^2 + bx + c = 0$:
\[
  x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}
\]
\end{document}
```

## diff

```diff
--- a/config.json
+++ b/config.json
@@ -1,5 +1,6 @@
 {
-  "version": "1.0.0",
+  "version": "1.1.0",
   "scripts": {
-    "start": "node index.js"
+    "start": "node index.js",
+    "test": "vitest"
   }
 }
```

## ProtoBuf

```protobuf
syntax = "proto3";

message User {
  int64 id = 1;
  string name = 2;
  string email = 3;
  repeated string roles = 4;
}

service UserService {
  rpc GetUser(GetUserRequest) returns (User);
}
```

## Ini / Properties

```ini
[database]
host = localhost
port = 5432
name = myapp

[cache]
driver = redis
ttl = 3600
```
