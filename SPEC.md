# ipod-pipeline — Project Specification

> Working name. Status: **Draft v0.1** — outline agreed, no code yet.
> This file is the single source of truth for what the app does. Changes go through a pull request.

---

## 1. Vision

A free, open-source desktop app that **finds music, downloads it at the best available quality, tags it cleanly, converts it, and builds an iPod-ready library** — with no command line. Syncing to the iPod is handed off to [iOpenPod](https://github.com/TheRealSavi/iOpenPod).

Existing tools split in two: iPod managers (no way to get music) and download automation like Lidarr (built around full albums, weak for single songs and playlists). This app covers the whole path from "I want this song" to "it's ready for my iPod," and treats single songs and albums equally.

---

## 2. Users

- **Public**, anyone on GitHub.
- Mixed technical levels. Setup must be guided; nothing should require a terminal.
- Primary device at launch: **iPod Classic 6th/7th gen on stock Apple firmware**, including SD-modded, large-capacity units.

---

## 3. Core workflow

```
Request → Search → Pick → Download → Tag → Convert → Library → iOpenPod sync
```

### 3.1 Ways to request music

All four feed one queue.

| Input | Behavior |
|---|---|
| Search box | Artist / album / song. Searches all enabled sources at once, one merged result list. |
| Playlist link | Spotify or Apple Music. App reads the track list, then searches for each track. |
| Text / CSV import | One line per track (`Artist – Title` or `Artist – Album`). |
| Drag in files | Skips downloading; goes straight to tagging and conversion. Implemented as a "Local files" source. |

**Playlist limits (must be documented):**
- Spotify API access now requires a Premium account, and Development Mode often blocks reading playlist tracks. Fallbacks: read public playlist pages, or have the user export to CSV.
- Apple Music: public playlist links only (the official API requires a paid developer account).

### 3.2 Choosing results

- **Single search:** the user picks from the full results list. Recommended picks are highlighted.
- **Playlists and lists:** a **review screen**. The app pre-selects the best match for every track; the user changes any picks and approves the whole batch.
- Each result shows: format and quality (e.g. FLAC 16/44, FLAC 24/96, MP3 320), file size, album completeness, source, and for Soulseek, uploader speed and free-slot status.

### 3.3 Queue

- Every job shows status: searching → downloading → tagging → converting → in library → synced.
- Progress per job, retry on failure, history of finished jobs.

### 3.4 Wishlist

- Tracks or albums not found are kept on a wishlist and re-searched periodically.
- Per-item conditions (e.g. "FLAC only"). Optional auto-download when a match appears.

---

## 4. Sources

All sources are **plugins** and **off by default**. Each user enables only what they use, through a guided setup screen.

| Source | Search | Download | User needs |
|---|---|---|---|
| Soulseek | Built-in (bundled sockseek, formerly sldl) | Built-in | Free Soulseek account |
| Usenet | Their indexers (Newznab API) | SABnzbd or NZBGet | Usenet provider + indexer + downloader |
| BitTorrent | Torznab via Prowlarr or Jackett | Built-in engine (libtorrent) **or** qBittorrent / Transmission / Deluge | Prowlarr or Jackett; optionally their own client |
| Local files | Drag and drop | None | Nothing |

### Rules
- **Async jobs:** sources can start a background job, report progress (queued / downloading / done / failed, with percent), and hand back finished file paths.
- **Shared indexer code:** Newznab and Torznab are nearly identical; connecting Prowlarr once can cover both Usenet and BitTorrent.
- **Torrents keep seeding:** finished torrent files are **copied**, never moved, into the pipeline.
- **Built-in torrent engine** only seeds while the app is open. Private-tracker users should connect their own client.
- **Privacy warning** on BitTorrent setup: peers can see your IP; recommend a VPN.
- **Album completion (Soulseek):** after an album download, browse the uploader's folder to fetch missing tracks.
- **Incomplete albums:** user chooses move / keep / delete.
- **Upgrade to album:** option to turn a playlist of single songs into full-album downloads.

### Future sources
Bandcamp, YouTube Music.

---

## 5. Tagging

Fully **editable per user**.

### 5.1 Presets
- Built-in: **iPod Clean** (default), **Minimal**, **Keep original tags**.
- Users duplicate and edit presets, and save their own.
- Presets export/import as small files so people can share them.

### 5.2 Metadata sources
- **MusicBrainz** (default); **Discogs** optional (user's own free token).
- **Match-confidence threshold:** strong matches tag automatically; weak matches go to review.
- **Untagged files** identified by audio fingerprint (AcoustID).
- **Cover art** from the Cover Art Archive, falling back to embedded art.

### 5.3 Fields
Users choose which to write: title, artist, album artist, album, track # / total, disc # / total, year, genre, composer, grouping, comments, lyrics, BPM, sort fields.

| Field | Options |
|---|---|
| Year | Original release year / this edition's year |
| Genre | One or multiple; source MusicBrainz / Discogs / Last.fm; mapping table to clean messy genres |
| Lyrics | Fetched from LRCLIB and embedded |

### 5.4 Rules

| Rule | Options |
|---|---|
| "feat." artists | Keep in artist / move to title / remove |
| Multiple artists | Separator: `&`, `,`, `;` |
| Compilations | Auto-detect and set the compilation flag |
| Sorting | "The Beatles" sorts as "Beatles" |
| Capitalization | As-is / Title Case / sentence case |
| Cleanup | Strip junk like `[FLAC]`, `(2011 Remaster)` — each rule toggleable |
| Script | Original (e.g. Japanese) / romanized / both |

### 5.5 Artwork
- Default 500×500 baseline JPEG, embedded. Size is configurable.
- Optional `folder.jpg` alongside files.

### 5.6 Volume
- Optional Sound Check calculation for iPod volume leveling.

### 5.7 File naming
- Mp3tag-style templates, e.g. `%albumartist%/%album%/%disc%-%track% %title%`.

### 5.8 Safety
- Before/after preview table before writing, with inline edits.
- Original tags kept until the user confirms (undo).

### 5.9 Library tools
- Duplicate finder.
- Missing-track finder for incomplete albums.

---

## 6. Conversion and storage

### 6.1 Storage modes (user picks)

| Mode | Behavior |
|---|---|
| Library + iPod (default) | Originals kept in a library folder; converted copies prepared for the iPod |
| iPod only | Temp files deleted only after the iPod copy is confirmed |
| Library only | Builds a collection on the computer, no iPod |

### 6.2 Library options
- User chooses the library location.
- Keep original formats (default) or convert everything to one format.
- Folder and file naming from §5.7.
- **Duplicate check:** skip music already in the library, matched by MusicBrainz ID or audio fingerprint.
- **Auto-upgrade** (toggle): replace a lower-quality copy when a better one arrives (e.g. FLAC replaces MP3).

### 6.3 Conversion profiles
- **ALAC 16-bit / 44.1 kHz** — default for iPod Classic.
- **AAC 256** — Apple encoder on Mac, and on Windows when Apple's audio components are installed; best available encoder otherwise. Quality differences documented.
- **MP3 V0 / 320** — LAME.
- Custom user profiles.

### 6.4 Conversion rules
- Hi-res (above 16-bit / 48 kHz) converted to 16/44.1 with high-quality resampling and dither.
- Lossy files the iPod can play are **left untouched** (no MP3 → ALAC bloat).
- Incompatible lossy formats (OGG, Opus) converted to AAC, with a warning about quality loss.
- FLAC checksum verification before converting.
- Optional **fake-FLAC detection** (flags upscaled lossy files).
- Conversion cache; configurable number of parallel conversions.

---

## 7. iPod sync — handoff to iOpenPod (Option B)

This app **does not write the iPod database**. iOpenPod already does this well, cross-platform, with backups and sync review.

- Setup wizard detects iOpenPod and offers a download link if missing.
- **"Open in iOpenPod"** button next to the finished library.
- **To investigate:** whether iOpenPod's CLI can start a sync, so one button in our app does everything.
- The library is organized and converted so iOpenPod can sync it with no further processing.

**Future (Option C):** embed iOpenPod's Python database code for direct sync. Requires relicensing this project to **GPL-3.0**. Decide before any such code is written.

---

## 8. Safety and privacy

- Passwords and API keys stored in the OS credential store (Windows Credential Manager / macOS Keychain / Linux Secret Service) via `keyring`. Never in plain text, never in the repo.
- User settings stored in the OS app-data folder, never in the repo.
- No telemetry.
- Nothing is overwritten without a preview or an undo path (tags, library upgrades).
- README states that users are responsible for what they download.

---

## 9. Platforms and distribution

- **Windows, macOS, Linux.**
- Installers built automatically by **GitHub Actions** for each platform and published as **GitHub Releases**.
- Builds are unsigned at launch (SmartScreen / Gatekeeper warnings; documented). Code signing is a later decision.
- **Update checker** at launch.

### 9.1 Dependencies

**Built in — nothing for the user to install**

| Component | How |
|---|---|
| Python + libraries | Packaged in the installer (PyInstaller) |
| Soulseek client | sockseek bundled, run in the background |
| Tagging, cover art, lyrics | Python libraries + web APIs |
| Audio fingerprinting | `fpcalc` (Chromaprint), bundled |
| ALAC / MP3 conversion | ffmpeg, bundled or auto-downloaded on first launch |
| Basic BitTorrent | libtorrent engine |

**Optional — only for users who want the feature**

| Feature | User needs | Why not built in |
|---|---|---|
| Usenet | Provider, indexer, SABnzbd or NZBGet | Repair/extraction tooling and paid accounts; Usenet users already run these |
| Torrent search | Prowlarr or Jackett | Holds each user's tracker logins; hundreds of site integrations |
| Long-term seeding | Their own torrent client | Built-in engine seeds only while the app is open |
| AAC on Windows | Apple audio components (from iTunes) | Apple doesn't allow redistribution |

**Separate app:** iOpenPod (see §7).

### 9.2 First-run setup wizard
1. Choose sources (Soulseek / Usenet / BitTorrent).
2. Install or verify what each needs (one-click install of missing tools).
3. Test connections; show green checkmarks.
4. Choose library folder, tagging preset, conversion profile.
5. Detect iOpenPod.

A Soulseek-only user enters a username and password, and setup is done.

---

## 10. Architecture

- **Backend:** Python (FastAPI).
- **UI:** React + Vite, displayed in a native window with pywebview.
- **Packaging:** PyInstaller, one bundle per OS.
- **Plugin types** (auto-discovered, each in its own folder):
  - `sources/` — where music comes from
  - `processors/` — tagging, conversion
  - `targets/` — where finished music goes (library folder, iOpenPod handoff)
- Each plugin declares name, description, and settings fields (type, label, default, secret yes/no) so the UI renders its settings form automatically.
- Settings path via `platformdirs`; secrets via `keyring`.

---

## 11. Non-goals

- Writing the iPod database directly (until Option C is chosen).
- Streaming or playback.
- Podcasts, photos, video.
- iPods other than the Classic for the first release (conversion profiles may come later).
- Built-in Usenet downloading.
- Hosting or sharing content (the Soulseek client does not share user folders unless the user opts in).

---

## 12. Milestones

| Version | Scope |
|---|---|
| **v0.1 — Core pipeline** | Plugin system, Soulseek source, Local files source, search & results picker, queue, MusicBrainz tagging with default preset, ALAC conversion, library folder |
| **v0.2 — Batch input** | Playlist links, CSV/text import, batch review screen, wishlist |
| **v0.3 — More sources** | Usenet, BitTorrent (built-in engine + external clients), shared indexer support |
| **v0.4 — Handoff & onboarding** | iOpenPod detection and handoff, setup wizard, one-click dependency installer, background picker (§16) |
| **v1.0 — Public release** | Installers for all 3 OSes via GitHub Actions, update checker, docs, finalize issue templates and contributing guide (first versions exist) |
| **Later** | Follow artists for new releases, Bandcamp / YouTube Music sources, more devices, Option C |

Each scope item is tracked as a GitHub issue under its milestone.

---

## 13. Key decisions

| Decision | Reason |
|---|---|
| Hand iPod sync to iOpenPod (Option B) | Mature, cross-platform, tested; writing the iPod database ourselves is the riskiest part and would duplicate existing work |
| ALAC 16/44.1 default | Lossless, plays natively on the Classic; SD mods remove space concerns |
| Python + React + pywebview | Music tooling is Python-native; web UI is familiar to contributors; runs on all 3 OSes |
| All sources off by default | Each user opts in to what they use; keeps setup simple |
| MIT license | Permissive for contributors; revisit if Option C (GPL-3.0) |
| Bundled sockseek | Shipped as a separate executable with its GPL-3.0 license and a source link |

---

## 14. Open questions

- Can iOpenPod's CLI trigger a sync?
- Spotify fallback: public-page reading vs. CSV export — test both.
- Final app name.
- Code signing — later decision.

---

## 15. Project management

- **This file** — what the app does.
- **`docs/DECISIONS.md`** — decision log (moved from §13 once it grows).
- **GitHub Issues** — one per feature or bug; labels: `source`, `processor`, `target`, `ui`, `bug`, `core` (app-wide infrastructure).
- **Milestones** — match §12.
- **Projects board** — To Do → In Progress → Done.

---

## 16. Appearance: skins and backdrops

The look is defined in [`docs/DESIGN.md`](docs/DESIGN.md) (PL-1). This section covers what the user can change.

### 16.1 Skins
- The device body comes in two skins: **Ivory** (default) and **Graphite**, switched with the SKIN key.
- The screen stays black with white text on every skin.

### 16.2 Built-in backdrops
- The backdrop is what sits behind the device: **White** (default) and **Black**, as plain colors.
- **Match system:** White in light mode, Black in dark mode.

### 16.3 Built-in collections
- None. No third-party image collection is bundled unless its license allows redistribution (§16.7).

### 16.4 User images
- **Upload image:** a single image is **copied** into the app's user-data folder (per OS, via `platformdirs`).
- **Add folder:** a folder is **linked in place**: only its path is stored and its files are never copied, moved or changed. It is scanned for images, and thumbnails are generated lazily and cached, so folders with thousands of images stay fast. Removing a linked folder never touches the original files.
- User images never leave the user's computer.

### 16.5 Backdrop picker
- Opened with the SETUP key. Thumbnails grouped as **Built-in** and **My images** (uploads and linked folders).

### 16.6 Display and readability
- Fit options: **fill / fit / center**.
- **Darken** slider (0–80%) and optional **blur**, so the device stays readable on any image.
- Skin and backdrop choices persist across restarts.

### 16.7 Third-party images
- Third-party images are bundled only when their license allows redistribution.
- The license is stored in `docs/third-party/`, and the images are credited in `docs/third-party/CREDITS.md`.
