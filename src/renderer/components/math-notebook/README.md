# Math Notebook

Calculator-style notepad inspired by [Numi](https://numi.app). Write expressions in natural language — results appear instantly on every line.

## Arithmetic

Standard math operators and parentheses.

```
10 + 5          → 15
20 * 3          → 60
(2 + 3) * 4    → 20
2 ^ 10          → 1,024
5 300           → 5,300
```

## Word Operators

Use words instead of symbols.

| Operation      | Keywords                     |
|----------------|------------------------------|
| Addition       | `plus`, `and`, `with`        |
| Subtraction    | `minus`, `subtract`, `without` |
| Multiplication | `times`, `multiplied by`, `mul` |
| Division       | `divide`, `divide by`        |
| Modulo         | `mod`                        |

```
8 times 9           → 72
100 plus 50         → 150
200 without 30      → 170
10 multiplied by 3  → 30
17 mod 5            → 2
```

## Variables

Declare variables with `=` and reuse them across lines.

```
v = 20          → 20
v times 7       → 140
v + 10          → 30
```

## Labels

Prefix a line with a label followed by a colon — the label is ignored, only the expression is evaluated.

```
Price: $11 + $34.45     → 45.45 USD
Monthly: 1200 / 12      → 100
```

## Inline Quotes

Text inside double quotes is ignored.

```
$275 for the "Model 227"   → 275 USD
```

## Percentage

### Basic percentage

```
100 + 15%       → 115
200 - 10%       → 180
15% of 200      → 30
```

### Advanced percentage

| Operation                               | Example                | Result |
|-----------------------------------------|------------------------|--------|
| Adding percentage                       | `5% on 200`           | 210    |
| Subtracting percentage                  | `5% off 200`          | 190    |
| Percentage of one value relative to another | `50 as a % of 100` | 50     |
| Percentage addition relative to another | `70 as a % on 20`    | 250    |
| Percentage subtraction relative to another | `20 as a % off 70` | 71.43  |
| Value by percent part                   | `5% of what is 6`     | 120    |
| Value by percent addition               | `5% on what is 6`     | 5.71   |
| Value by percent subtraction            | `5% off what is 6`    | 6.32   |

## Scales

Shorthand for large numbers. One-letter scales are case-sensitive: `k` for thousands, `M` for millions.

```
$2k             → 2,000 USD
3M              → 3,000,000
1.5 billion     → 1,500,000,000
10 thousand     → 10,000
```

## Currency

Supports ISO 4217 codes, common currency symbols, and common currency names. Live exchange rates with cached fallback.

### Supported symbols

| Symbol | Currency |
|--------|----------|
| `$`    | USD      |
| `€`    | EUR      |
| `£`    | GBP      |
| `¥`    | JPY      |
| `₽`    | RUB      |
| `₴`    | UAH      |
| `₩`    | KRW      |
| `₹`    | INR      |
| `R$`   | BRL      |

### Supported ISO codes

USD, EUR, GBP, CAD, RUB, JPY, CNY, CHF, AUD, KRW, INR, BRL, MXN, PLN, SEK, NOK, DKK, CZK, HUF, TRY, NZD, SGD, HKD, ZAR, THB, UAH, ILS.

```
$30 + $15           → 45 USD
$30 to EUR          → ... EUR
€50 + £20           → ... EUR
5 dollars + 10 dollars → 15 USD
```

## Unit Conversion

Powered by mathjs. Use `to`, `in`, `as`, `into` for conversion.

```
5 km to mile                → 3.10686 mile
5 km into mile              → 3.10686 mile
1 inch in cm                → 2.54 cm
100 celsius to fahrenheit   → 212 fahrenheit
1 kg to lb                  → 2.20462 lb
1 meter 20 cm               → 1.2 m
1 meter 20 cm into cm       → 120 cm
1 point to inch             → 0.0138889 inch
1 are to m^2                → 100 m^2
1 degree to radian          → 0.0174533 radian
1 nautical mile to mile     → 1.15078 mile
```

### Supported unit categories

- **Length**: meter, inch, foot, yard, mile, nautical mile, point, line, hand, furlong, cable, league, etc.
- **Weight**: gram, kg, pound, ounce, tonne, stone, carat, etc.
- **Temperature**: celsius, fahrenheit, kelvin
- **Time**: second, minute, hour, day, week, month, year
- **Angular**: radian, degree, and `°`
- **Data**: bit, byte, KB, MB, GB, TB (with SI and binary prefixes)
- **Area**: m², hectare, acre, are, plus aliases like `sq`, `square`, `sqm`
- **Volume**: liter, gallon, pint, quart, cup, teaspoon, tablespoon, plus aliases like `cu`, `cubic`, `cb`, `cbm`

## CSS Units

Supports CSS-oriented `px`, `pt`, and `em` conversions with configurable `ppi` and `em`.

```
12 pt in px       → 16 px
em = 20px
1.2 em in px      → 24 px
ppi = 326
1 cm in px        → 128.35 px
```

## Math Functions

```
sqrt(16)        → 4
sqrt 16         → 4
cbrt 8          → 2
root 2 (8)      → 2.8284
sin(45 deg)     → 0.7071
sin 45°         → 0.7071
cos(pi)         → -1
log(100)        → 2
log 2 (8)       → 3
ln(e)           → 1
abs(-42)        → 42
round(3.7)      → 4
round 3.45      → 3
ceil(3.2)       → 4
floor(3.9)      → 3
fact(5)         → 120
arcsin(1)       → 1.5708
arccos(1)       → 0
arctan(1)       → 0.7854
```

## Number Formats

Append `in hex`, `in bin`, `in oct`, or `in sci` to format the result.

```
255 in hex      → 0xFF
10 in bin       → 0b1010
255 in oct      → 0o377
5300 in sci     → 5.3e+3
5 300 in sci    → 5.3e+3
```

Input also supports hex, binary, and octal literals:

```
0xFF            → 255
0b1010          → 10
0o377           → 255
```

## Previous Result

Use `prev` to reference the result from the previous line.

```
10 + 5          → 15
prev * 2        → 30
prev - 5        → 25
```

## Sum & Total

`sum` or `total` calculates the sum of all numeric results above (until an empty line).

```
10 + 5          → 15
20 * 3          → 60
sum             → 75
```

## Average

`average` or `avg` calculates the mean of all numeric results above (until an empty line).

```
10
20
30
average         → 20
```

## Comments

Lines starting with `//` or `#` are treated as comments and produce no result.

```
// This is a comment
# This is also a comment
```

## Date & Time

Convert Unix timestamps to dates with `fromunix`.

```
fromunix(1446587186)    → 11/3/2015, ...
fromunix(1446587186) + 2 day
```

Time arithmetic follows Numi-like semantics: `1 year = 365 days`, `1 month = 365 / 12 days`.

Current time helpers:

```
time
time()
now
now()
now in Madrid
Berlin now
time() + 1 day
now + 1 day
```

Time zone conversion:

```
PST time
New York time
Time in Madrid
2:30 pm HKT in Berlin
2:30 pm New York in Berlin
2026-03-06 PST in Berlin
2026-03-06 2:30 pm PST in Berlin
Mar 6 2026 PST in Berlin
2:30 pm Mar 6 2026 PST in Berlin
tomorrow PST in Berlin
```

Time unit arithmetic:

```
1 month in days          → 30.4167 days
round(1 month in days)  → 30
round 1 month in days   → 30
2 hours + 30 minutes    → 2.5 hours
```

## Constants

| Name | Value        |
|------|--------------|
| pi   | 3.1415926536 |
| e    | 2.7182818285 |

## Bitwise Operations

```
5 & 3           → 1
5 | 3           → 7
5 xor 3         → 6
1 << 4          → 16
16 >> 2         → 4
6 (3)           → 18
```

## SI Prefixes

SI-based units support all SI prefixes (case-sensitive):

```
1 mm            → 0.001 m
3 GB            → 3e+9 bytes
2 MHz           → 2,000,000 Hz
```
