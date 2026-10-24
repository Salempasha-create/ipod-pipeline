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
| 2026-10-24 | Spec §12 synced with GitHub issues #1–#23 (Soulseek and Local files split; templates and contributing guide marked as finalize-only for v1.0). Added a core label for app-wide infrastructure. | Keep SPEC.md, milestones and issues consistent; #1 Plugin system spans all plugin types, so it gets its own label |
| 2026-10-24 | Appearance: backgrounds added to the spec (§16): White (default), Black and match-system built-ins, plus user uploads stored locally. No bundled image collection at launch. | Personal images stay on the user's computer. The planned "Yuki Posters" collection is held back because no license allowing redistribution was found; third-party images are bundled only with such a license stored in `docs/third-party/` |
