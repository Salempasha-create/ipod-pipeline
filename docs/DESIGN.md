# Pipeline PL-1 — UI Design Spec

> Source of truth for the app's look. The approved design is **PL-1**: the app is a single piece of audio hardware.
> Exact visual reference: `docs/design-reference/pl1-main-screen.html` and `docs/design-reference/pl1-design-system.html`.
> Those files are mockups written in a design-canvas format: read them for layout, sizes, colors and copy. They are not runnable app code.
> In them, `/_blob/1e9a…` = `ui/src/assets/design/icons-duotone-back.svg`, `/_blob/d369…` = `icons-duotone-front.svg`, `/_blob/3a32…` = `grain.png`.

---

## 1. Concept

PL-1 is a music device: a textured body shell, a black screen with white text, a click wheel, physical-looking keys, and a disc changer where every album is a minidisc whose shell color shows where it came from. Strict and tactile: one orange key per screen, everything else quiet.

---

## 2. Rules

1. **Orange means "do this":** one primary key per screen, plus the active marker. Nothing else is orange.
2. **Each source owns one color**, used for its LED, icon backing and disc shell. Nothing else uses it.
3. **The screen is always black with white text**, on every skin.
4. **Skins change the body** (Ivory, Graphite). **Backdrops** are what sits behind the device: White (default), Black, and the user's own images.
5. **Device labels in Space Mono; anything you read in Geist; numbers and data in Geist Mono.**

---

## 3. Typography

Bundled locally (offline app) via npm font packages pinned to exact versions.

| Role | Font | Weights | Used for |
|---|---|---|---|
| Device labels | Space Mono | 700 | Wordmark "PIPELINE" (26px, +3px tracking), printed key labels, section titles like CHANGER, counters |
| Reading | Geist | 400, 500, 600, 700 | Album titles, notes, anything a person reads in sentences |
| Data | Geist Mono | 400, 500, 600, 700 | Formats, sizes, tracks, statuses, small labels (11–14px, uppercase, +1–1.5px tracking) |

No pixel fonts. Minimum 11px for uppercase mono labels, 14px for reading text.

---

## 4. Colors

### Skins (body)
| Token | Ivory (default) | Graphite |
|---|---|---|
| body | `#ECE9E2` | `#29292D` |
| seam (outline) | `#BDB7AB` | `#45454C` |
| hi (top highlight) | `rgba(255,255,255,0.8)` | `rgba(255,255,255,0.08)` |
| ink | `#161616` | `#F2F1EC` |
| soft (secondary text) | `#4A4741` | `#BAB8B1` |
| bezel | `#D3CEC4` | `#151517` |
| wheel gradient | `#F8F6F2` → `#D8D3C9` | `#3C3C41` → `#222226` |
| wheel recess | `#CFCAC0` | `#1B1B1E` |
| wheel center | dark: `#4A4A4F` → `#2B2B2F` → `#1E1E21`, edge `#141416` | light: `#FFFFFF` → `#ECE9E2` → `#CBC6BC`, edge `#8F8A80` |
| key / key edge | `#F7F5F0` / `#B0AA9E` | `#35353B` / `#1A1A1D` |
| slot | `#E0DCD3` | `#1F1F22` |
| card | `#F1EEE8` | `#2E2E33` |
| dots (speaker grille) | `#3A3833` | `#0B0B0C` |
| icon back | `#D3CEC4` | `#4A4A51` |
| dim (empty progress) | `rgba(22,22,22,0.14)` | `rgba(242,241,236,0.16)` |

### Fixed colors
| Name | Value | Use |
|---|---|---|
| Screen | `#0C0C0D` | The black screen, LIB counter |
| Screen text | `#F4F4F2` | Text on the screen |
| Screen secondary | `#A3A3A0` | Secondary text on the screen |
| Selected row | `#1A1A1C` with `rgba(244,244,242,0.35)` edge and an orange left bar |
| Action | `#FF5B14` | Primary key, active marker, LIB counter digits, focus ring |
| Primary key | gradient `#FF7333` → `#FF5B14` → `#EE4F0B`, edge `#B8400B`, label `#141414` |
| Backdrop White | `#F4F4F2` | Default backdrop |
| Backdrop Black | `#0B0B0C` | |

### Sources
| Source | Code | Color | Disc shell gradient (160deg) |
|---|---|---|---|
| Soulseek | SLSK | `#4D7CFF` | `#7FA0FF` → `#4D7CFF` → `#2F57D9` |
| Usenet | USNT | `#FFC21A` | `#FFE07A` → `#FFC21A` → `#D99A00` |
| BitTorrent | BTRT | `#2FCB7E` | `#74E3AA` → `#2FCB7E` → `#189A5A` |
| Local files | LOCL | `#A3A3A0` | `#8A8A90` → `#5E5E64` → `#3A3A3F` |

Quality pills: lossless = solid outline, lossy = dashed outline.

All text must meet WCAG AA contrast.

---

## 5. The device (layout)

- **Backdrop** fills the window; the **device body** sits centered on it: max 1280px wide, 34px radius, 26px padding, skin body color, 1px seam, inset top highlight, large soft shadow, and the **grain texture** (`grain.png`, 256px tile, 60% opacity) over the body.
- **Header:** "PIPELINE" (Space Mono) + "PL-1 · MUSIC FETCHER" (Geist Mono, soft) · source status LEDs with codes (SLSK, USNT, BTRT, LOCL) glowing in their colors · LIB counter (black inset display, orange Space Mono digits, e.g. `001204`) · minimize and close ("eject") keys, 44px.
- **Main row:** the **Screen** (left, large) and the **Controls** column (right).
- **Screen** (black, white text): page tabs SEARCH / QUEUE n / LIBRARY / SOURCES with the active one marked in orange, a status line (e.g. "4 RESULTS · 3 SOURCES · 0.8 S"), then the current page.
- **Controls column:** the click wheel, the big orange **DOWNLOAD** key under it, then two secondary keys **SKIN** and **SETUP**, then a speaker-grille dot pattern.
- **Changer** (below): title "CHANGER" + status line ("3 DISCS LOADED · 1 READY · DISC COLOR = SOURCE"), a secondary key "SEND TO iOPENPOD", the loaded discs (minidisc + stage, percent, album, detail, 20-segment progress in the source color), and a "DROP FILES or folders from your computer" key.
- **Footer:** printed device labels: "FIND · TAG · CONVERT · CARRY" and "ALAC 16/44.1 · iPOD CLASSIC READY · SER. 0001".

Match sizes, spacing and radii to the reference HTML.

---

## 6. Click wheel

- Four buttons: SEARCH (top), QUEUE (right), LIBRARY (bottom), SOURCES (left), each with its two-tone icon and a small mono label; the active one gets the orange marker. They mirror the screen's page tabs.
- Recessed ring around a dark (Ivory skin) or light (Graphite skin) **center button with no text**, `aria-label="Select"`, which runs the current page's primary action.
- Keyboard: arrow keys move between pages, Enter/Space presses the center.

---

## 7. Components

- **Keys:** primary (orange gradient, 60px, Space Mono 16px label, 4px bottom lip in edge color); secondary (key color, 48px, Geist Mono 12px label, 3px lip). Both with inset top highlight. Icon left of label.
- **Search input** on the screen with the search icon; filter chips (ALL SOURCES / FLAC ONLY / MP3 ONLY) and a "COMPLETE ALBUMS FIRST" checkbox.
- **Results rows** on the screen: source icon · title (Geist 600) + BEST badge (orange, star icon) + "Source · uploader" line · quality pill · size · tracks · 5 speed bars in the source color. Selected row: `#1A1A1C`, light edge, orange left bar.
- **Selection strip** under the results: picked title + plain-language note, and the route TAG —— ALAC 16/44.1 (or KEEP MP3) —— LIBRARY with icons.
- **Minidisc:** rounded rectangle in the source shell gradient, white label area (album + artist), metal shutter (light-to-gray gradient), small write-protect notch. Used in the Changer and anywhere an album is shown as an object.
- **Focus:** 3px `#FF5B14` outline, 2px offset. Targets ≥ 44px.

---

## 8. Icons

**Phosphor Icons, duotone weight (MIT).** Each icon is two layers: a filled "back" shape in a signal color and the "front" line drawing in ink on top.

- Sprites: `ui/src/assets/design/icons-duotone-back.svg` and `icons-duotone-front.svg` (24 icons in a row, 256px cells). Render with CSS masks exactly like the reference (`mask-size: 2400% 100%`, position = index / 23 × 100%), or replace with `@phosphor-icons/react` duotone icons if they match 1:1.
- Order (index → name): 0 Search, 1 Download, 2 Tag, 3 Convert, 4 Library, 5 Soulseek, 6 Usenet, 7 BitTorrent, 8 Local, 9 Queue, 10 iOpenPod, 11 Sources, 12 Cassette, 13 Setup, 14 Eject, 15 Best, 16 Done, 17 Minimize, 18 List, 19 Backdrop, 20 Skin, 21 Add, 22 Levels, 23 Music.
- Back color: the source color for source icons; orange for Download, Eject, Skin, iOpenPod and Best; otherwise the skin's icon-back color.

---

## 9. Pages

- **Search:** as in the reference.
- **Queue:** jobs listed on the screen by stage with 20-segment progress; discs also visible in the Changer.
- **Library:** albums as rows with quality pills; empty state pointing to Search.
- **Sources:** source list with LED, code, enable toggle and the auto-generated plugin settings form; secrets via keyring.
- **Setup (SETUP key):** Backdrop picker and other settings.
- **Skin (SKIN key):** toggles Ivory ↔ Graphite.

---

## 10. Backdrops

- Built-in: **White** (default), **Black**, and **Match system**.
- **Upload image:** copies a single image into the app's user-data folder (platformdirs).
- **Add folder:** links a folder in place (stores the path, never copies), scans it for images, and generates cached thumbnails lazily so folders with thousands of images stay fast. Removing it never touches the original files.
- Picker grouped as Built-in / My images. Fill, fit and center; darken 0–80%; optional blur. Persisted.
- No third-party image collection is bundled unless its license allows redistribution.

---

## 11. Credits

- Phosphor Icons — MIT License → `docs/third-party/phosphor-icons-LICENSE.txt`.
- Geist and Geist Mono — SIL Open Font License; Space Mono — SIL Open Font License.
- All listed in `docs/third-party/CREDITS.md`.
