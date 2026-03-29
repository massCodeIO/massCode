# Math Notebook

<AppVersion text=">=4.6" />

Calculator-style notepad inspired by [Soulver](https://soulver.app). Write expressions in natural language — results appear instantly on every line.

## Arithmetic

Standard math operators and parentheses.

```
10 + 5         → 15
20 * 3         → 60
(2 + 3) * 4    → 20
2 ^ 10         → 1,024
5 300          → 5,300
```

## Word Operators

Use words instead of symbols.

```
8 times 9             → 72
100 plus 50           → 150
10 and 5              → 15
10 with 5             → 15
200 without 30        → 170
20 subtract 3         → 17
10 multiplied by 3    → 30
100 divide by 4       → 25
17 mod 5              → 2
```

## Variables

Declare variables with `=` and reuse them across lines.

```
v = 20       → 20
v times 7    → 140
v + 10       → 30
```

## Labels

Prefix a line with a label followed by a colon — the label is ignored, only the expression is evaluated.

```
Price: $11 + $34.45    → 45.45 USD
Monthly: 1200 / 12     → 100
```

## Inline Quotes

Text inside double quotes is ignored.

```
$275 for the "Model 227"    → 275 USD
```

## Percentage

### Basic percentage

```
100 + 15%     → 115
200 - 10%     → 180
15% of 200    → 30
```

### Advanced percentage

```
5% on 200           → 210
5% off 200          → 190
50 as a % of 100    → 50%
70 as a % on 20     → 250%
20 as a % off 70    → 71.43%
5% of what is 6     → 120
5% on what is 6     → 5.71
5% off what is 6    → 6.32
```

### Percentage change

```
50 to 75 is what %       → 50%
40 to 90 as %            → 125%
180 is what % off 200    → 10%
180 is what % on 150     → 20%
20 is what % of 200      → 10%
```

### Fractions & multipliers

```
2/10 as fraction      → 1/5
50% as fraction       → 1/2
0.25 as fraction      → 1/4
20/5 as multiplier    → 4x
50 as x of 5          → 10x
50 to 75 is what x    → 1.5x
```

### Decimal/percentage conversion

```
0.35 as %         → 35%
20/200 as %       → 10%
20% as dec        → 0.2
50% to decimal    → 0.5
```

## Scales

Shorthand for large numbers. One-letter scales are case-sensitive: `k` for thousands, `M` for millions.

```
$2k            → 2,000 USD
3M             → 3,000,000
1.5 billion    → 1,500,000,000
10 thousand    → 10,000
```

## Currency

Supports 166+ fiat currencies (ISO 4217 codes), 21 cryptocurrencies, common currency symbols, and word names. Live exchange rates with cached fallback.

### Supported symbols

| Symbol | Currency |
| ------ | -------- |
| `$`    | USD      |
| `€`    | EUR      |
| `£`    | GBP      |
| `¥`    | JPY      |
| `₽`    | RUB      |
| `₴`    | UAH      |
| `₩`    | KRW      |
| `₹`    | INR      |
| `CA$`  | CAD      |
| `AU$`  | AUD      |
| `HK$`  | HKD      |
| `NZ$`  | NZD      |
| `R$`   | BRL      |

### Cryptocurrencies <AppVersion text=">=5.0" />

BTC, ETH, SOL, DOGE, XRP, ADA, DOT, LTC, AVAX, SHIB, BNB, USDT, USDC, XLM, XMR, EOS, TRX, DASH, NEO, BCH, ETC.

### Custom exchange rates <AppVersion text=">=5.0" />

```
50 EUR in USD at 1.05 USD/EUR    → 52.50 USD
```

```
$30 + $15                 → 45 USD
$30 to EUR                → ... EUR (live rate)
€50 + £20                 → ... EUR (live rate)
5 dollars + 10 dollars    → 15 USD
```

## Unit Conversion

Use `to`, `in`, `as`, `into` for conversion.

```
5 km to mile                 → 3.10686 mile
5 km into mile               → 3.10686 mile
1 inch in cm                 → 2.54 cm
100 celsius to fahrenheit    → 212 fahrenheit
1 kg to lb                   → 2.20462 lb
1 meter 20 cm                → 1.2 m
1 meter 20 cm into cm        → 120 cm
1 point to inch              → 0.0138889 inch
1 are to m^2                 → 100 m^2
1 degree to radian           → 0.0174533 radian
1 nautical mile to mile      → 1.15078 mile
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
12 pt in px     → 16 px
em = 20px
1.2 em in px    → 24 px
ppi = 326
1 cm in px      → 128.35 px
```

## Rounding

```
1/3 to 2 dp                   → 0.33
pi to 5 digits                → 3.14159
5.5 rounded                   → 6
5.5 rounded down              → 5
5.5 rounded up                → 6
37 to nearest 10              → 40
2100 to nearest thousand      → 2,000
21 rounded up to nearest 5    → 25
490 to nearest hundred        → 500
```

## Math Functions

```
sqrt(16)       → 4
sqrt 16        → 4
cbrt 8         → 2
root 2 (8)     → 2.8284
sin(45 deg)    → 0.7071
sin 45°        → 0.7071
cos(pi)        → -1
log(100)       → 2
log 2 (8)      → 3
ln(e)          → 1
abs(-42)       → 42
round(3.7)     → 4
round 3.45     → 3
ceil(3.2)      → 4
floor(3.9)     → 3
fact(5)        → 120
arcsin(1)      → 1.5708
arccos(1)      → 0
arctan(1)      → 0.7854
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
0xFF      → 255
0b1010    → 10
0o377     → 255
```

## Previous Result

Use `prev` to reference the result from the previous line.

```
10 + 5      → 15
prev * 2    → 30
prev - 5    → 25
```

## Sum & Total

`sum` or `total` calculates the sum of all numeric results above (until an empty line).

```
10 + 5    → 15
20 * 3    → 60
sum       → 75
```

## Average

`average` or `avg` calculates the mean of all numeric results above (until an empty line).

```
10
20
30
average    → 20
```

## Comments

Lines starting with `//` or `#` are treated as comments and produce no result.

```
// This is a comment
# This is also a comment
```

## Date & Time

### Current time

```
time              → (current time)
now               → (current date & time)
now()             → (current date & time)
time() + 1 day    → (tomorrow)
now + 1 day       → (tomorrow)
```

### Calendar

```
days since January 1                   → ... days
days till December 25                  → ... days
days between March 1 and March 31      → 30 days
5 days from now                        → (date)
3 days ago                             → (date)
3 months from now                      → (date)
2 years ago                            → (date)
3 weeks after March 14, 2019           → (date)
28 days before March 12                → (date)
day of the week on January 24, 1984    → Tuesday
week of year                           → (current week number)
week number on March 12, 2021          → (week number)
days in February 2020                  → 29 days
days in Q1                             → 90 days
```

### Timestamps

```
current timestamp               → (unix timestamp)
January 1, 2020 to timestamp    → 1577836800
fromunix(1446587186)            → 11/3/2015, ...
1733823083000 to date           → (date)
June 15, 2020 as iso8601        → 2020-06-15T00:00:00.000Z
2019-04-01T15:30:00 to date     → (date)
```

Time arithmetic follows Numi-like semantics: `1 year = 365 days`, `1 month = 365 / 12 days`.

### Time zone conversion

Zones can be specified as:

- **Timezone codes**: PST, EST, CET, JST, etc.
- **Airport codes** <AppVersion text=">=5.0" />: LAX, JFK, SFO, NRT, CDG, SYD, etc.
- **City names** <AppVersion text=">=5.0" />: Seattle, Berlin, Tokyo, Dubai, etc.
- **Country names** <AppVersion text=">=5.0" />: Japan, Germany, France, etc.

```
PST time                                      → (current time in PST)
New York time                                 → (current time in New York)
Time in Madrid                                → (current time in Madrid)
time in Tokyo                                 → (current time in Tokyo)
7:30 am LAX in Japan                          → (converted time)
time difference between Seattle and Moscow    → ... hours
2:30 pm HKT in Berlin                         → (converted time)
2:30 pm New York in Berlin                    → (converted time)
2026-03-06 PST in Berlin                      → (converted date)
tomorrow PST in Berlin                        → (converted date)
```

Time unit arithmetic:

```
1 month in days           → 30.4167 days
round(1 month in days)    → 30
round 1 month in days     → 30
2 hours + 30 minutes      → 2.5 hours
```

## Constants

```
pi     → 3.1415926536
e      → 2.7182818285
tau    → 6.2831853072
phi    → 1.6180339887
```

## Bitwise Operations

```
5 & 3      → 1
5 | 3      → 7
5 xor 3    → 6
1 << 4     → 16
16 >> 2    → 4
6 (3)      → 18
```

## SI Prefixes

SI-based units support all SI prefixes (case-sensitive):

```
1 mm     → 0.001 m
3 GB     → 3e+9 bytes
2 MHz    → 2,000,000 Hz
```

## Finance

<AppVersion text=">=5.0" />

### Compound interest

```
$1,000 after 3 years at 7%                                        → $1,225.04
$1,000 for 3 years at 7% compounding monthly                      → $1,232.93
$1,000 for 3 years at 7% compounding quarterly                    → $1,231.44
interest on $1,000 after 3 years @ 7%                             → $225.04
$500 invested $1,500 returned                                     → 3x
annual return on $1,000 invested $2,500 returned after 7 years    → 13.99%
present value of $1,000 after 20 years at 10%                     → $148.64
monthly repayment on $10,000 over 6 years at 6%                   → $165.73
total repayment on $10,000 over 6 years at 6%                     → $11,932.48
total interest on $10,000 over 6 years at 6%                      → $1,932.48
```

## Cooking Conversions

<AppVersion text=">=5.0" />

130+ food substances with density data for accurate volume-to-mass and mass-to-volume conversions.

```
density of yogurt             → 1.06 g/cm³
density of olive oil          → 0.916 g/cm³
300g butter in cups           → ~1.39 cups
10 cups olive oil in grams    → ~2,168 grams
```

Supports cups, tablespoons, teaspoons, fl oz, pints, quarts, and gallons.

## Video & Timecode

<AppVersion text=">=5.0" />

Timecode format `HH:MM:SS:FF` with `at` or `@` to specify frame rate (default 24 fps).

```
00:30:10:00 @ 24 fps in frames       → 43,440 frames
03:10:20:05 at 30 fps + 50 frames    → (timecode)
30 fps * 3 minutes                   → 5,400 frames
```

## Workday Calculations

<AppVersion text=">=5.0" />

```
workdays in 3 weeks                 → 15 workdays
workdays from March 3 to March 7    → ... workdays
2 workdays after March 3, 2025      → (date)
```

## Clock Time Intervals

<AppVersion text=">=5.0" />

```
7:30 to 20:45    → 13 hours 15 min
4pm to 3am       → 11 hours
9am to 5pm       → 8 hours
```

Midnight crossing is handled automatically.

## Timespan & Laptime

<AppVersion text=">=5.0" />

### Timespan

```
5.5 minutes as timespan    → 5 min 30 s
72 days as timespan        → 10 weeks 2 days
```

### Laptime

```
5.5 minutes as laptime            → 00:05:30
03:04:05 + 01:02:03 as laptime    → 04:06:08
```

### Stacked time

```
3h 5m 10s    → 11,110 seconds
```

## Base N Conversion

<AppVersion text=">=5.0" />

Convert between arbitrary bases.

```
0b101101 as base 8    → 0o55
0xFF as base 2        → 0b11111111
```

Python-style functions:

```
hex(99)      → 0x63
bin(0x73)    → 0b1110011
int(0o55)    → 45
```

## Large Numbers

<AppVersion text=">=5.0" />

Use `B`/`bn` for billion and `T`/`tn` for trillion, or word forms.

```
10 trillion    → 10,000,000,000,000
```

## Additional Functions

<AppVersion text=">=5.0" />

```
larger of 100 and 200             → 200
smaller of 5 and 10               → 5
half of 175                       → 87.5
midpoint between 150 and 300      → 225
random number between 1 and 10    → (random)
gcd of 20 and 30                  → 10
lcm of 5 and 8                    → 40
10 permutation 3                  → 720
25 combination 3                  → 2,300
clamp 26 between 5 and 25         → 25
```

## Proportions

<AppVersion text=">=5.0" />

```
6 is to 60 as 8 is to what     → 80
5 is to 10 as what is to 80    → 40
```

## Conditions

<AppVersion text=">=5.0" />

```
if 5 > 3 then 10 else 20    → 10
42 if 5 > 3                 → 42
42 unless 5 > 3             → 0
5 > 3 and 10 > 7            → true
```

## Comment Syntax

<AppVersion text=">=5.0" />

End-of-line comments and parenthesized remarks are stripped before evaluation.

```
100 + 20 // add 20
$999 (for iPhone)
```

## Preferences

<AppVersion text=">=5.0" />

Math Notebook has configurable preferences:

- **Locale** — 14 languages for number and date formatting
- **Decimal places** — 0 to 14
- **Date format** — Numeric, Short, Long
- **Refresh buttons** for fiat and crypto exchange rates
