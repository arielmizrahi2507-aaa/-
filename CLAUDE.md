# CLAUDE.md: Judokan Eilat (ג'ודוקאן אילת) website

The owner writes in Hebrew and is not a developer. **Reply in Hebrew**: short, plain, no jargon; say what changed and how to see it.
Code, comments, commit messages and this file are English. The site itself is Hebrew (RTL).

## Repo map

| Path | What it is |
|---|---|
| `docs/` | The published site (GitHub Pages: branch `main`, folder `/docs`). **Generated: never hand-edit `docs/*.html`** (the generator also deletes pages it no longer produces). |
| `tools/build_site.py` | The single source of every page: sidebar, footer, icon sprite, forms, all text, JSON-LD, CSP. `python3 tools/build_site.py` rewrites `docs/*.html`. Env: `JK_EMAIL` (club e-mail, enables the e-mail option), `JK_OUT` (output folder, for test builds). |
| `docs/assets/css/style.css`, `docs/assets/js/main.js` | Hand-written style and script (edited in place). Fonts (Heebo, Shippori Mincho subset) and the logo are self-hosted; licences in `docs/assets/LICENSES.txt`. |
| `tools/make_logo_assets.py`, `tools/logo/` | PNG icons and share image from `docs/assets/img/logo.svg` (a vector redrawn from the club's shirt). |
| `tools/make_preview.py` | One self-contained HTML file of the whole site, for viewers that show a single file. Writes `build/preview/`. |
| `tools/tests/` | The automated checks (below). |
| `SITE_README.md` | Hebrew owner documentation: publishing, the source of every fact, items to verify with the club, security notes. Keep it in step with behaviour changes. |
| `bot.py`, `server.py`, `requirements.txt` | An unrelated older WhatsApp bot. Not part of the site; leave alone. `bot.py` holds a hard-coded credential default which the owner was told to revoke (SITE_README, "ממצאים מחוץ לאתר"). Never print or copy it; `sec-scan` keeps warning about it until it is gone. |

## Commands

```
python3 tools/build_site.py                    # rebuild docs/ after editing the generator
cd tools/tests && npm ci                       # once per fresh checkout (Node 22.22+; needs Chromium: CHROMIUM_PATH, or /opt/pw-browsers in the cloud)
python3 -m venv tools/tests/.venv && tools/tests/.venv/bin/pip install -r tools/tests/requirements.txt
                                               # optional: enables cjk-scan (otherwise it is skipped); the runner finds this venv by itself
node tools/tests/run-all.mjs --strict          # everything, ~4 min (3 suites at a time); exit code 0 only if every suite passed and none was skipped
node tools/tests/run-all.mjs --quick           # fast subset while iterating, ~1 min
node tools/tests/run-all.mjs --only forms,menu # chosen suites (--list shows the names); --jobs 1 runs them one by one (~9 min for everything)
python3 tools/make_preview.py                  # build/preview/judokan-eilat-site.html
```

## Rules from the owner (do not relax)

- **Only true, researched information.** Every fact must be verifiable; SITE_README ("מקורות לנתונים") records where each came from. Never invent names, numbers, prices, hours, medals or quotes. Unknown detail: leave it out or ask. No sources or citations are shown on the site.
- **Voice**: the club's own (first person plural, gender-neutral where possible), using the club's own sentences. No invented marketing copy.
- **Wording**: "ג'ודו" / judo only, never "דוג'ו" / dojo.
- **Legal to publish**: only assets we own or have a licence for (OFL fonts, Feather icons under MIT, the club's own logo). No stock or scraped images, no athlete names without consent (Privacy Protection Law s. 2(6)), no cookies, tracking, analytics or third-party requests.
- **Privacy**: details leave the page only when the visitor presses a send button, after ticking the consent box; the privacy link in the consent text opens in the same tab. The site has no server and stores nothing.
- **Accessibility**: Israeli Standard 5568 (WCAG 2.1 AA), checked against WCAG 2.2 AA with axe: keyboard, visible focus, contrast (small red text and links use `--accent-ink` `#C4221B`; the brand red `--accent` `#EE362E` is for large surfaces and large text), reduced motion, 200% text, 320 px reflow, 24 px targets. `accessibility.html` must describe the real features and their limits (no screen-reader test was done).
- **Look**: red `#EE362E` and white, modern-classic. The dark sidebar is the numbered list with Japanese characters (the owner's design) on desktop **and** phone. There is **no separate contact page**: the home page ends with the red band "מוכנים להתחיל?" (`#join`), which holds the one full form and, below it (the owner's request), the contact details (call, copy, WhatsApp, Waze, Google Maps, days and hours). Every "צור קשר" link on the site points at `#join`. The side-scrolling strips have no arrows, dots or counters. On phones the page's own scroll moves them: the owner wants "scroll like normal, only sideways, and continue normally after", so a strip stays put under the header while the cards slide sideways 1 px per px of page scroll, then the page goes on. Swipe, mouse drag and arrow keys still work and the page follows the strip. It is off for `prefers-reduced-motion`, for the accessibility options "עצירת אנימציות" and "בלי גלילה לצד", and for a strip taller than the free screen (header to bottom bar). A strip that does not fit is first tried with tighter cards (class `hs-tight`: less padding and smaller number glyphs, same text size) so the tall ones (programs, champions, principles) also pin on a screen about 560 px tall; only if that does not fit either does it stay a plain swipe strip.

## Invariants the tests enforce

- Each page carries a CSP `<meta>`: `default-src 'none'`, `script-src 'self'` plus the sha256 of the tiny inline script (INIT_JS; the generator computes the hash, so edit it only in `build_site.py`), no inline styles or handlers, `connect-src 'none'`, `form-action https://wa.me`. The JS never uses `innerHTML` or `eval`; visitor input never reaches the DOM as HTML.
- No server: the forms validate and build `https://wa.me/...` or `mailto:` links. Buttons are `type="button"` with click handlers (a sandboxed viewer blocks `submit`). Enter or the phone's "Next" moves to the next field. `CLUB_EMAIL` in `build_site.py` is empty on purpose; the e-mail option then opens a draft without a recipient.
- It works without scripts: the inline script puts class `js` on `<html>`. Without it, the phone menu is the static numbered list, the forms are replaced by a plain card (one textarea, a GET form to `https://wa.me/972505788781`), and the carousel buttons and dots are simply absent.
- Everything is local: no CDN, no remote fonts or images.

## Tests (`tools/tests`)

Every suite is its own script, prints a line such as `N checks, M failures` and exits non-zero on failure. `run-all.mjs` runs them, writes logs to `build/test-logs/`, prints one line per suite and exits non-zero if any failed.
- `static/`: `docs/` equals the generator's output, html-validate, links and anchors, security and secret scan, Japanese glyphs present in the font, contrast of the colour tokens.
- `site/`: Playwright and axe on a served `docs/`: accessibility, keyboard, reflow, mobile, menus, CSP, forms (with and without a club e-mail), carousels (swipe, drag, keys), pinned scroll (page scroll moves the cards, real touch, fallbacks), captions (belt ladder, number ranges), content parity between wide and narrow screens, no-script.
- `preview/`: the single-file preview, also embedded in sandboxed iframes and `srcdoc`, with and without scripts.
- `lib.mjs` holds the shared parts (`launch()`, `siteUrl()`, `previewHtml()`, `AXE`). A suite also runs alone: `node tools/tests/site/menu-test.mjs`.
- Fixing a bug: add or extend a test that fails without the fix (revert the fix once to watch it fail), then fix. New suite: add the script and list it in `SUITES` in `run-all.mjs`.
- Never skip, loosen or delete a check to get green. If a check is wrong, say why and fix the check.
- The typing and touch tests use real key and tap events on purpose: filling fields programmatically once hid a real phone bug.

## The preview file

The owner views files in an in-app viewer that most likely **blocks scripts** (inferred from their screenshots and complaints, never confirmed) and may embed files through `srcdoc`. So `tools/make_preview.py` builds one file that works either way: the other pages become `#view-*` sections shown by CSS `:target`; the site sits in a wrapper `<iframe srcdoc>` with `<base href="about:srcdoc">` (otherwise fragment links resolve against the parent's address and load the wrong page); a yellow banner appears when scripts do not run. Send it with `SendUserFile` (display `render`) and say that validation and sending only work after downloading the file and opening it in Chrome or Safari. Never deploy it; `build/` is git-ignored.

## Workflow

- Work on branch `claude/affectionate-bardeen-3433bg`; commit and push there. No pull request unless the owner asks. In cloud sessions a platform stop hook blocks ending a turn with uncommitted, untracked or unpushed work, so commit and push before you finish.
- After touching `build_site.py`, the CSS, the JS or the assets: rebuild, run the tests, and only then call it done. Report failures as they are.
- Keep the Hebrew texts in step with reality: `SITE_README.md`, and the accessibility and privacy text inside `build_site.py` whenever a feature changes.
- Look at visual changes yourself (a Playwright screenshot at 1440 px and at 390 px) before showing them to the owner.
- Commit messages: an imperative English summary line, plus a short body when the reason is not obvious.

### Using `/goal`

The condition is judged from the transcript after every turn, so ask for something the transcript can show. Example:

```
/goal Done when `node tools/tests/run-all.mjs --strict` has exited 0 (its last line reads "0 failed, 0 skipped"), `git status` is clean and the branch is pushed. If still blocked after 25 turns, stop and say what blocks.
```

## Pitfalls already hit

- Playwright `javaScriptEnabled: false` makes `page.evaluate` hang. Simulate "no script" by aborting `**/assets/js/main.js` and removing class `js` (see `site/axe-nojs.mjs`).
- `pkill -f <pattern>` can match and kill your own shell. Use `pgrep -f "[p]attern"` first.
- The phone menu covered the form after navigation: any page change must close it (main.js and the preview router).
- A fragment link inside a `srcdoc` iframe loads the parent's page unless `<base href="about:srcdoc">` is set.
- A numeric range with an en dash inside right-to-left text shows reversed ("7–4"). Wrap it as `<bdi dir="ltr">4–7</bdi>` (in a `<select>` option, which cannot hold markup, write it with words: "4 עד 7"). `captions-test` checks this.
- Captions that sit side by side (belt ladder) must wrap or stack instead of shrinking: a caption that does not fit runs into its neighbour. `captions-test` sweeps widths 300 to 1500 px.
- Pinned strips (`.hs` > `.hs-stage` > `[data-hs]`): the stage is `position: sticky`, which only works while no ancestor scrolls, so `.content` must keep `overflow-x: clip` (never `hidden` or `auto`). The stage is `display: contents` (no box) everywhere except a pinned strip, so wide screens and the no-script page keep their grids. The negative margins `--hs-g` give the strip back its normal place before and after the pin; the stage must not take taps (`pointer-events: none`) because it overlaps the text around the strip. The script tells its own `scrollLeft` writes from the visitor's moves by value (`written`), and follows a visitor's move by scrolling the page (`pinAdopt`); do not compare against a flag. `pinned-scroll-test` checks all of this, and reduced motion, the two options, tall strips (phone on its side, enlarged text) and print.
