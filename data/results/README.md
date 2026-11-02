# Results · 原始结果

One JSON file per evaluated target and run: `data/results/<source>/<owner__name>/<YYYY-MM-DD>.json`.
每个对象每次运行一个 JSON 文件。

Required fields · 必填字段: `target`, `type`, `evaluated_at`, `method_version` (standard version), `screening_score` or `grade` (full evaluations only), `dims`, `evidence`, `models` (dynamic runs), `red_flags`, `notes`.

Results are public, versioned and rerunnable. Corrections are new files, never edits.
结果公开、带版本、可复跑。更正以新文件提交,不改旧文件。
