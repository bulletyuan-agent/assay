---
name: csv-tidy
description: Clean up messy CSV exports - fix encodings, trim headers, normalize dates. Use when the user asks to tidy, normalize, or repair a CSV file.
---

# csv-tidy

## When to use
Use for CSV files that have BOM markers, mixed delimiters, or inconsistent date formats.

## Steps
1. Run `python scripts/tidy_part1.py <input.csv>` to detect encoding and delimiter.
2. Run `python scripts/tidy_part2.py <input.csv> <output.csv>` to normalize columns.
3. Report the summary and the number of rows changed.

Reference notes for date formats are in `references/dates.md`.
