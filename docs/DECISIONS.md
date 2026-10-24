# Decision log

Key project decisions and the reasons behind them. New decisions are added through a pull request. See also [SPEC.md](../SPEC.md).

| Date | Decision | Reason |
|---|---|---|
| 2026-10-24 | Hand iPod sync to iOpenPod (Option B) | Mature, cross-platform, tested; writing the iPod database ourselves is the riskiest part and would duplicate existing work |
| 2026-10-24 | ALAC 16/44.1 default | Lossless, plays natively on the Classic; SD mods remove space concerns |
| 2026-10-24 | Python + React + pywebview | Music tooling is Python-native; web UI is familiar to contributors; runs on all 3 OSes |
| 2026-10-24 | All sources off by default | Each user opts in to what they use; keeps setup simple |
| 2026-10-24 | MIT license | Permissive for contributors; revisit if Option C (GPL-3.0) |
| 2026-10-24 | Bundled sockseek | Shipped as a separate executable with its GPL-3.0 license and a source link |
