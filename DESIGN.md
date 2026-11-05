# Sciora Design System

Authority for every UI decision in this repo. When this file and the code disagree,
the code is wrong. Format follows the design-skill convention (SKILL.md/DESIGN.md):
tokens → component rules → accessibility → anti-patterns → QA checklist.

## 1. Context and goals

Sciora is an e-learning platform for one lecturer and their students. Two modes:

- **Persuade** — `/` landing. One headline, one action. Expression is allowed.
- **Operate** — `/login`, `/notes`, `/profile`, `/test`, `/admin`. Scanability,
  consistency and keyboard access outrank expression. Brand lives in the details.

The committed visual world: **frosted glass over a parallax photographic background,
indigo accent, Geist type, spring easing, custom cursor.** Refine it, never replace it.

## 2. Design tokens

All tokens live in `src/app/globals.css`. **No raw hex values in components.**

| Token | Light | Dark | Use |
|---|---|---|---|
| `--background` | `#fafaf9` | `#050507` | Page surface |
| `--foreground` | `#0f0f0f` | `#f0f0f2` | Primary text |
| `--muted` | `#525252` | `#a1a1aa` | Secondary text — **min tier for any text** |
| `--muted-strong` | `#3f3f46` | `#d4d4d8` | Emphasised secondary |
| `--faint` | `#737373` | `#71717a` | Placeholders/disabled only |
| `--accent` / `--accent-hover` | `#6366f1` / `#4f46e5` | same | Interactive accent |
| `--accent-fg` | `#ffffff` | — | Text on accent |
| `--danger` / `--success` / `--warning` | `#b91c1c` / `#047857` / `#b45309` | `#f87171` / `#34d399` / `#fbbf24` | Status |
| `--glass-bg` / `--glass-border` / `--edge` | — | — | Surfaces and 1px borders |
| `--shadow-sm/md/lg/xl` | — | — | Elevation, offset + soft blur |
| ↳ utility `shadow-soft` / `shadow-card` / `shadow-float` / `shadow-lift` | — | — | Use these four, never `shadow-[…]` |
| `--focus` | `rgba(99,102,241,.75)` | — | The single focus ring |
| `--ease-spring` / `--ease-out-expo` | — | — | The only two curves |

Tailwind maps these to `text-muted`, `bg-accent`, `border-edge`, `text-danger`, …
Using a token class is mandatory; `text-neutral-400`, `#6366f1`, `shadow-[…]` in
markup are violations.

**Radii:** controls `rounded-xl` (12px), cards `rounded-2xl`/`rounded-3xl`, pills
`rounded-full`. Elevation is declared **once** — `.glass` for resting, `.lift` for
interactive. Never stack a 1px border under a wide shadow *and* a hover shadow.

## 3. Component rules

Every interactive component ships all of: `default`, `hover`, `focus-visible`,
`active`, `disabled`, plus `loading` and `error` where it can fail.

- **Button** (`components/ui/Button.tsx`) — only way to make a button.
  `primary` | `glass` | `danger` | `subtle`. Min target 44×44px. `loading` swaps in a
  spinner, sets `aria-busy`, and blocks repeat clicks. Never `cursor: pointer`
  styling without a real `disabled` state.
- **Field** (`components/ui/Field.tsx`) — only way to make an input. Always has a
  visible `<label>`, `aria-invalid` + `aria-describedby` on error, focus ring from
  `.field:focus-visible`. Placeholder is never the label.
- **Modal** (`components/ui/Modal.tsx`) — `role="dialog"`, `aria-modal`,
  `aria-labelledby`, Escape closes, focus is trapped and restored, backdrop click
  closes unless a request is in flight. Modals are for destructive confirmation or
  protected input only.
- **Toast** (`components/ui/Toast.tsx`) — replaces every `alert()`/`window.confirm`.
  Region is `aria-live="polite"`; failures use `role="alert"`. Success 4s, error
  stays until dismissed.
- **Card** — `.glass` + `.lift` for clickable, `.glass` alone for static,
  `.card-outer`/`.card-inner` for hero-weight objects (login, active test).
- **Skeleton** (`components/ui/Skeleton.tsx`) — loading must mirror the shape of the
  content that follows. Never a bare spinner where layout is known.
- **EmptyState** (`components/ui/EmptyState.tsx`) — every list must have one; it
  names what is missing and the next action.
- **PageHeader** (`components/ui/PageHeader.tsx`) — eyebrow icon+label, `h1`,
  optional description, right-aligned actions. One per page.
- **Motion** (`src/lib/motion.ts`) — `EXPO`/`SPRING` curves and the stagger
  variants live there. Entrance: opacity + 16–24px rise + 8px blur, 0.4–0.7s.
  Hover: ≤1.04 scale or ≤6px lift. Nothing animates without a state change.

## 4. Accessibility

Non-negotiable, all testable:

- **Contrast:** body/secondary text ≥4.5:1, large text ≥3:1. `--muted` is the floor;
  anything fainter is placeholder-only.
- **Focus:** one visible ring (`:focus-visible`, 2px, `--focus`, 2px offset) on every
  control. `focus:outline-none` without a replacement ring is prohibited.
- **Keyboard:** every `onClick` surface is a `<button>`/`<a>` or carries
  `role="button"`, `tabIndex={0}` and Enter/Space handling. Radio/choice lists are
  real `<input type="radio">` inside a `<fieldset><legend>`.
- **Targets:** ≥44×44px for anything clickable.
- **Announcements:** async results go through the toast region or `role="alert"`;
  timer/progress uses `role="timer"` or `aria-live="polite"`.
- **Motion:** `prefers-reduced-motion` is honoured globally in `globals.css`.
- **Identity:** screen readers get `aria-label` on icon-only buttons and
  `alt`/`aria-hidden` on decorative imagery.

## 5. Content and tone

Concise, confident, helpful. Controls name their action ("Enter Classroom", not
"Continue"). Errors name the problem **and** the recovery ("Upload failed — check
your connection and try again"). No filler, no exclamation marks, no emoji as icons.

## 6. Anti-patterns (prohibited)

- Raw hex / raw `rgba()` / arbitrary Tailwind color values in component markup.
- Text below `--muted` contrast; `text-neutral-400` on light surfaces.
- A control that looks enabled but does nothing (the dead-button bug).
- `alert()`, `window.confirm`, `console.error` as the only user-facing feedback.
- A click handler with no keyboard path.
- Two different button/card systems inside one route.
- Duplicate markup blocks that differ only in label (extract instead).
- Skeletons that don't match their content; infinite loading with no error branch.
- Motion that runs on load for every section identically, or decorative-only blur.

## 7. QA checklist (run before merge)

1. `npm run lint` and `npm run build` pass.
2. Grep for violations: `text-neutral-400`, `#[0-9a-f]{6}`, `shadow-[`, `alert(`,
   `focus:outline-none`, `backdrop-blur-xl` outside `.glass`.
3. Tab through the changed page: every control shows the focus ring, order is
   logical, no trap except inside a modal (which must release on Escape).
4. Toggle light/dark: no text drops below 4.5:1, no white-on-white surfaces.
5. Every list shows loading → content **or** error-with-retry **or** empty state.
6. Every button either works or is visibly `disabled` with a reason.
7. Every async action reports success or failure through the toast region.
8. Text selection, caret, scrollbar and focus rings are themed, not browser default.
