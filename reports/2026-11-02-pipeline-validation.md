# Pipeline validation report · 流水线验证报告 (2026-11-02)

**This is not a trust rating of any project.** It validates the evaluation pipeline itself: are results reproducible, traceable, and worth anything. The 7 targets were chosen as presumed-good calibration items, not as subjects of judgement.
这不是对任何项目的信任评级,而是对评测流水线本身的验证。

- Method version: 0.1.2 (static screening only, nothing executed, no grade)
- Run: `run-20261102T141913Z` · tool commit `6477721` (clean)
- Raw results: `data/results/github/<owner__name>/2026-11-02.json` (7 files)
- Run event log: `data/results/runs/run-20261102T141913Z.jsonl`
- Calibration inputs: `data/calibration/set-v0.json`, `data/calibration/results-latest.json`

## 1. Observability · 可观测性

| Question | Answer | Evidence |
| --- | --- | --- |
| What ran, when, with which code? | Yes | run event log; tool commit and dirty flag in every result |
| Can a score be traced to evidence? | **Yes** | `verify-run.mjs`: deductions recompute every dimension; composite recomputes from published weights and cap; all 7 pass |
| Does each finding point to a line? | Yes | file, line, snippet; 3 results re-read from source and matched |
| Can the run be reproduced? | **Yes** | rerun on 3 targets (one truncated) gave identical scores and dimensions; tree sha pins the scanned input |
| What network calls were made? | Yes (count, status, duration) | 40 to 87 calls per target in the log |
| **Which files were scanned?** | **No** | only counts are stored, not the list of paths. Gap. |

## 2. Reference value · 参考价值

Verdict: **the pipeline is traceable, but the scores carry almost no information yet.**

1. **All 7 deductions across the 7 results are false positives.** Apache license-header URL, a URL inside a shell comment, a `//` comment containing `eval`, `.example` placeholders, a blog link in a code comment. Not one was a real behaviour risk. The 93 versus 100 difference is noise, not signal.
2. **Coverage is partial and the headline score hides it.** 5 of 7 scans were truncated: 80 files scanned out of 110 to 388 candidates (about 21 to 73 percent). The cut is the first 80 paths in alphabetical order, not the most important files. A `100` on a quarter of the files is a weak statement.
3. **Good items cluster at 93 to 100.** With no real bad items, the screen cannot be shown to separate anything. See calibration.
4. **Blind check on a real incident (reconstructed `postmark-mcp`): missed.** The reconstruction scores 100. The exfiltration target is a hard-coded `Bcc` email address, and the egress rule only looks at URLs. This item was not used to tune any rule.

## 3. What the numbers can and cannot support · 能与不能支持的结论

- Can: this pipeline is reproducible and auditable; deductions are explainable line by line.
- Cannot: that a project is safe, that 100 is better than 93, or that the screen detects real malicious packages.
- Therefore no result from this pipeline may be published as a rating yet.

## 4. Fixes required before publishing any rating · 发布评级前必须修复

1. Strip comments and string-only placeholders before scanning; treat license-header and `.example` hosts as non-findings.
2. Prioritise files (entry points, install scripts, tool handlers) instead of alphabetical truncation; show coverage next to the score.
3. Store the scanned path list in each result.
4. Add detection of hard-coded recipient addresses and similar exfiltration channels, validated on **new** blind incidents, not on the postmark reconstruction.
5. Collect at least 10 verified real bad items per category (see `data/calibration/incidents-v0.json`).

## 5. Limits of this report

One run, one day, seven presumed-good public repositories, static analysis of GitHub code only. Labels of "good" are reputation, not audit.
