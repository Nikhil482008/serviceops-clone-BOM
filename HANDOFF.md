# Handoff — 2026-08-06

## Open TODO(api) — BOM Licensing readings panels (added 2026-08-11)

The redesigned readings strip in `public/bom-admin/index.html` has two panels whose
data is **derived locally from stamps on the CI records**, so the panel can be judged
before the endpoint exists. Neither is a hardcoded chart — each is computed from the
same records the tables beneath them render, so panel and table cannot disagree — but
the history is local to a page load and needs a real source before this ships.

| Panel | Needs | Currently |
|---|---|---|
| **Seats available** → seat-consumption trend | `GET /admin/bom-licensing/seat-history?days=30\|90` — seats in use per day | `seatSeries(days)` counts CIs whose `enrolledAt` ≤ that day; `enrolledAt` is stamped per CI in `seedRuleEnrolments()`, spread over 90 days |
| **Agent-scanned** → sync recency + stale list | the agent's own last check-in per CI | `c.lastSync`, stamped in the same seeder. `c.seen` (the Last-seen column) is now **derived from it** via `licSeen()` rather than stored beside it, so the two can no longer drift |
| **End Point ID** column (added 2026-08-11) | the endpoint id discovery holds for the CI — `GET /cmdb/ci/{id}` | `c.ep`, stamped by `seedEndpoints()` as `EP-<n>` across the **agent-scanned** CIs only. A manually ingested CI has no agent, so no endpoint, and the cell renders `—` rather than inventing one |

Also worth knowing: `c.by` (auto vs manual enrolment) is now derived from the rules —
a CI is auto-enrolled iff an **enabled** rule genuinely matches it **and** it is
agent-scanned. Before this change 25 CIs claimed "by rule" with no rule behind them,
and only 3 of 68 recorded which rule. The taxonomy the page now asserts is:
enrolled → agent-scanned | manually ingested, and agent-scanned → added by a rule |
added manually. `kpitest.js` guards every one of those identities.

## BOM Licensing table — All CIs tab + column changes (2026-08-11)

The CI table gained a third tab, **All CIs**, which is every seat in one list and the
page's default landing. It is the only place all three enrolment types appear together,
so it is the only honest target for a filter across them; **Manual Enrolment** (45) and
**Auto-enrol** (57) still partition it (102).

Columns are now `CI ID · End Point ID · Host Name · CI Type · IP Address ·
Enrollment Type · Last seen · Actions`. **Status was removed** — every row on this page
holds a licence seat, which is the only status the page is about — and with it the row
dimming that was its only other encoding, plus the Status filter group (a filter for a
column nobody can see). **Origin became Enrollment Type**, carrying the three values
`Auto enrolled · Manually enrolled · Manually ingested`, defined once in `ENROL_TYPES`
and read by the column, the filter and the panel splits alike (`enrolType(c)`).

Two defects surfaced while wiring it, both fixed:

- `ruleFresh()` did not exclude manually ingested CIs, so a rule save could stamp
  `by:"Auto"` on a CI with no agent — the tab count and the new column would then
  disagree about the same row. It now applies the same agent-only rule as the seeder.
- Saving a rule set `LIC_TAB="rules"`, which was never a tab id; it only worked because
  the strip was binary and anything not `"manual"` fell through to Auto-enrol. Now
  `"auto"` explicitly.

Panel splits also had to be repointed: "Added manually" (33) used to open the Manual tab
(45), and the stale-agent "See the full list" opened a tab that need not contain the CIs
it listed. Segments now land on **All CIs** filtered to exactly the segment named;
`data-licf` accepts a comma list for this (`auto,manual` = agent-scanned). Guarded by
`alltab.js`.

## BOM Licensing table — pagination, and the Auto-enrol strip removed (2026-08-11)

`licCiTable()` now pages at **`LIC_PER_PAGE = 15`** on all three tabs. Paging is a
reading device, not a filter: every count on the screen — tab totals, the bulk bar, the
readings strip — stays a whole-set number and only the rows are cut. `licPagerHTML()`
renders "1–15 of 102" plus a windowed page list that always keeps first and last
reachable; it appears **only when the list exceeds one page**. `LIC_PAGE` resets to 1 on
tab / search / filter changes and is **clamped** (not reset) on re-render, so deleting
the last row of the last page lands on the new last page instead of the top.

Pagination changes what the header checkbox can honestly mean, so it now takes **the
current page** (`aria-label` says so). Selection is a Set of ids and survives page
moves, so ticking pages accumulates; when a full page is selected and more remains, the
bulk bar offers **"Select all N"** — `#licSelAllF` — to restore the one-click reach the
old unpaged table had.

The **Auto-enrol summary strip** (`sumstrip inset`: Auto-enrolled CIs · Rules · Waiting
to enrol) was deleted along with its only CSS rule, `.sumstrip.inset`. Every figure it
carried is already above it — auto-enrolled CIs is the tab's own count, rules and
waiting-to-enrol are the "Auto-enrol rules" reading — so it was a third telling of the
same numbers between the tabs and the rows. `sumstrip` itself is untouched and still
used by BOM Policies (`#bpSum`) and Scheduler (`#bsSummary`). Guarded by `pager.js`.

## BOM Licensing — auto-enrol rule drawer (2026-08-11)

Three changes, all in the `LIC_DRAWER` branch of `renderLicDrawer()`.

**The "Rule is enabled" card is gone.** A new rule is created enabled (`auto:true` in the
draft) and turning an existing one off is a one-click switch in the rules list and the
readings panel — asking again inside the builder gave one decision two homes. `d.auto` is
still on the draft and still initialised from `r.on` when editing, so opening and saving a
**disabled** rule does not silently switch it on (`drawer.js` asserts this). The shared
condition builder keeps its own `.cb-power` card — that one governs auto-include, a
different thing.

**Targeting is now an explicit either/or.** The policy band and the condition builder used
to stack with nothing to say they were alternatives, so both read as live. `licTargetPickHTML()`
draws two radio options — *Use a BOM Policy* / *Define conditions here* — with an "or"
between them, and **only the selected one carries controls**. `d.tmode` (`"policy"` |
`"conditions"`) is the switch; `licSetMode()` moves the DATA, not just a class: choosing
policy stashes `groups` and empties them, choosing conditions restores the stash and nulls
`policyId`. That is what keeps `ruleHits`, `licTargeted`, the preview and save honest
without any of them learning about modes. A new rule opens on conditions; editing opens on
whichever the rule uses.

To avoid forking the chooser, the band's content was extracted and is shared: `POL_ICON`,
`POL_TITLE`, `polDescHTML(pol)`, `polControlsHTML(pol, o)`. `polBandHTML()` (Scheduler,
Retention) and `licTargetPickHTML()` both borrow them — important because `wirePolChooser`
binds by id, so a copied control block would be a second, unwired chooser. `polControlsHTML`
also drops the "· N total" suffix when it equals the matching count.

**The footer count is gone** (`licFootLine` deleted). The number still has one home, the
preview block, which also carries the seat maths.

Note for anyone driving the drawer in a test: "Create new BOM Policy" and the policy select
only exist once the **policy arm is selected** — `policy.js` clicks `[data-tmode="policy"]`
first. Guarded by `drawer.js`.

## BOM Scheduler + Retention — targeting rework (2026-08-12)

`targetCardsHTML` (policy band + two cards) and `polBandHTML` are **deleted**;
`tgtChoiceHTML(d, o)` is mounted by both drawers.

**Two cards, side by side, and a rule can carry BOTH.** Automatic (**Recommended**) and
Add CIs by hand (Fixed) are not alternatives — `targetIds()` unions them, and always did.
Each card owns one of them, states its own count and current state, and **is itself the
click target**; the button inside is `.btn.ter` (new tertiary style — transparent, brand
text) carrying the id but *no handler*, so its click bubbles to the card and the two can
never disagree about what they do. Wiring is one `[data-tgtgo]` handler per drawer.

*(An earlier pass this session made them mutually exclusive radio arms with a stashing
`tgtSet`/`tgtInit`. That was reverted — both helpers are gone. If exclusivity is ever
wanted again, the stash approach is in the git history for this file.)*

**The Automatic card does not ask HOW.** It reports what is chosen — "Follows BOM Policy
X — <its conditions>" / the condition summary / "Not set up yet" — with a live count, and
its button opens the **next drawer**, which is the existing stacked condition builder
repurposed: title *"How should CIs be chosen?"*, two arms (`Use a BOM Policy` /
`Define conditions here`), and beneath them either the policy controls or the inline group
editor plus its match preview. One question per surface. This **removes** a level rather
than adding one — reuse and own-conditions used to be on different surfaces.
`openCond()` seeds `COND.tmode`/`COND.policyId`; `cbApply` writes the chosen definition and
**clears the other**, so a rule cannot carry a policy and conditions that disagree.

**The condition builder's on/off switch is gone** (`cbAuto`, its `.cb-power` card, the
"auto-include is off" preview line, and the dead `.cb-power` CSS). `COND.auto` is always
`true`: choosing a definition IS switching it on. `d.auto` survives in the model meaning
"conditions are the chosen definition".

**Scheduler name is first and required** — above "Schedule setup", `*` marked, `bsDSave`
refuses and focuses it, `bsEcho(d)` demoted to a placeholder. Tests that saved a schedule
without naming it had to start naming it.

**Both footers lost their left-hand count** ("Scans N of 102 enrolled CIs" / "Applies to
N of…"). The cards carry those numbers now, next to the thing that produces them.

**Stack routing had to be reordered.** `ddSet`'s condition-group target was
`COND ? … : BP_DRAFT ? …`; with the definition drawer open beneath the BOM Policy editor
that sent the editor's own conditions into the rule underneath it. The stack is rule
drawer → definition drawer → policy editor, so it now reads
`BP_DRAFT ? … : COND ? … : LIC_DRAWER ? …`. `tgPol` routes to `COND` first for the same
reason (and gained the `BS_DRAFT` fallback it never had).

Known, pre-existing: `schedctl.js`'s two "last execution" checks fail in the morning —
`seedRuns()` only records runs whose scheduled time has already passed today, so the suite
only passes later in the day. Verified against the committed file; not a regression.
Dead `.polband` (bare), `.tpick`/`.tchoice`-adjacent and `.tgt-*` CSS remains in the
stylesheet — `.tchoice`/`.tpick` are still used by the Licensing drawer and the definition
drawer, `.tgt-*` no longer by anything.

## BOM Scheduler page — readings, toolbar and Run now (2026-08-12)

**The strip became three KPI cards**, reusing the page's EXISTING card system
(`.kpis`/`.kpi`/`.kh`/`.knum`/`.klabel`/`.ksec`/`.kcta`) that the inventory and Retention
already use — an early pass declared a second `.kpis`/`.kpi` rule set, which would have
restyled both of those pages. Only what the scheduler genuinely adds is new: `.kstate`
(a card whose subject is a state, not a count), `.kcta.warn`, `.kcta.on`.

Each card's footer **is** the thing it names rather than a caption about it:

- **Coverage** — `54 / 102 CIs`; the footer `48 CIs not covered →` opens `BS_UNCOV`, a
  drawer listing exactly those CIs. It is computed as the complement of `bsCovered()`,
  never a second tally, and offers *New schedule* as the way out of the gap.
- **Active policies** — `4 / 5`; the footer `1 disabled →` applies the `paused` filter to
  the list below, reads *Showing disabled only ×* while on, and clears on a second click.
- **Automatic BOM generation** — the scheduler's own state AND its Pause/Resume switch.
  The `#bsState` control beside *New schedule* is deleted (with its dead `.schedctl` CSS),
  so the state is no longer reported in two places. This replaced the old *Scan activity*
  reading, whose execution figures the control already carried.

**The list matches Licensing.** The toolbar (title + count + search + Filter) moved INSIDE
the `.sc-wrap` card as a `.tabs` row above the rows it filters, instead of floating above
the card as a page heading; the `.sechd` block is gone. Because the toolbar is now
re-rendered, `#bsQ` is bound inside `renderScheduler` with the caret restored — the old
page-level listener would have been lost on every render. **Order matters:** the toolbar
must render before the filter-control block, since it is what creates `#bsFilter`.

**Run now** is a real button (`.runbtn`) rather than a text action, and a manual run is
pinned to **`BS_RUN_MS = 10000`** whatever it covers — progress is spread across that
duration (`every = BS_RUN_MS / total`) so 1 CI and 33 CIs both take ten seconds while the
count still climbs honestly. The **Completed state is gone** (`justDone` deleted): a button
that reports the last run is a status pretending to be an action, and it made the row's
only way to run again unavailable while it lingered. It now goes Run now → Running n/N →
Run now.

Note on the suites: `schedctl.js` and `sched.js` described the old header control and the
old strip, so both were rewritten against the new shapes. While doing it, `schedctl.js`'s
two long-standing morning failures were fixed properly — they assumed a run had already
happened today, and now assert the *derivation* (what is shown comes from the run log)
with a "No execution yet today" branch. `sched3.js` is the new suite for this page.

## BOM Retention — the Default policy card, compacted (2026-08-12)

The default policy stays a **KPI card in the readings row** (`.kpis.four`, four cards, default
first). It is one of the family — same `.kpi` frame, same `.kh` header primitive, same grid
cell — it just carries two values instead of one count.

```
⏱ Default policy                    [✎ Edit]
KEEP LAST          DELETE AFTER
10 versions        90 days
```

- **The Edit control moved into the header's right corner** (`.kh-r`, an `.iact` button,
  `aria-label="Edit default policy"`). The full-width button row underneath was what made the
  card tall. It is the only interactive element; the card body is not clickable and has no
  hover state.
- **Values are label/value pairs** (`.kpair` / `.kpair-c`): the micro-label reuses the existing
  `.suml` primitive, and the value reuses the siblings' `.knum` with a **size modifier**
  `.knum.sm` (26px) so two fit one card — a modifier on the shared primitive, not a second
  number system. The figure carries the weight, the unit stays muted in `.ku`, exactly as the
  counting cards read.
- **Nothing below the values** — no explainer line, no button row. The card is two children,
  `kh` then `kpair`, asserted as such.
- `numUnit()` splits `"10 versions"` into figure + unit. `"Never delete"` has no figure so it
  does not get a fake one: the pair reads `DELETE AFTER / Never` with no unit span.

**"Whichever limit is reached first." was already** helper text under the two fields in the
default-policy drawer (`.rtc-note`) — nothing had to move, it was only removed from the card.
`ret2.js` asserts it is absent from the card and is the last element of the drawer body.

*(An earlier pass this session made this a full-width row above the table — `.defrow`. That is
reverted and the CSS removed; the spec is a card in the row.)*

### Retention-policy section in the exception drawer (2026-08-12)

The two limits were one sentence with the selects embedded in it — *"Keep the latest [10
versions] or delete versions older than [90 days]"* — with mismatched control widths and no
sign of what was being overridden.

Now **two labelled fields of equal width** (`.polgrid` + the same `.fld`/`.flab` primitive as
the name field above), so the section reads as a form and the two things to set are obvious:

```
Retention policy — what these CIs keep instead of the default
Keep the latest              Delete versions older than
[ 10 versions        ▾ ]     [ 90 days              ▾ ]
⚠ These are the default values, so this exception would change nothing.
  Set a different limit above — that is what makes it an exception.
```

**The warning is the point.** `rtOpen(null)` seeds the draft from `RT_DEFAULT`, so a new
exception opens *identical to the default* and changes nothing — that was invisible.
`rtSameAsDefault(d)` detects it and the drawer says so on open. Move either limit and the
warning is replaced by an ordinary baseline line: `rtNote()` plus
"Default is 10 versions or 90 days." Move it back and the warning returns. `rtdrawer.js`
asserts all three states.

Not touched: the **BOM Policy capability composer** still uses the old `.polstack`/`.polline`
sentence for `bpKeep`/`bpPeriod` (so that CSS is still live, not dead). Different context —
those values are not seeded from a default, so the no-op warning would not apply there. Worth
aligning the field layout if that surface gets attention.

### Proposed, NOT built — default as row zero of the exceptions table

The alternative is to render the default as a **pinned first row inside the rules table**
(`Name: "Default — every CI"` · `Applies To: every enrolled CI` · `Retention: Last 10 · 90 days`
· action `Edit`), on a subtly tinted background, so overrides read literally as exceptions to
row zero. It is cheap to build — `renderRetention()` already emits the `<tbody>` in one place,
and the row would take the same `.sc-table td` cells with a tint class.

Trade-off worth deciding before building: the table's other rows are **editable, deletable and
toggleable** objects, and the default is none of those. A row that looks identical but silently
drops three of the four row actions is a consistency the user has to unlearn.

## BOM Policies — readings as KPI cards, yellow banner removed (2026-08-12)

`#bpSum` was a `.sumstrip`; it is now the same three-card `.kpis` family as Scheduler and
Retention, and the page-wide yellow overlap banner (`#bpBanner`) is **deleted**.

Each footer is a way through to what it counts, which is what let the banner go — its detail
now opens from the reading that reports it instead of shouting the same fact a second time
underneath:

| Card | Figure | Action |
|---|---|---|
| **Policies** | `5 / 5` active | `1 used by nothing →` filters the list to policies no rule references (`BP_SHOW`); reads *Showing unused only ×* while applied |
| **CIs governed** | `92 of 130` | `38 governed by none →` opens `BP_UNGOV`, the complement of the coverage set, so the two always add to the discovered estate |
| **Overlaps** | `1` (amber) | `Review precedence →` opens `BP_OVL`, the old banner's content — each pair, the capability, the shared-CI count, both priorities, and which one wins; the policy names open the policies |

The count chip above the table stays the **total**; the unused filter narrows rows, not the
fact. Escape closes both new drawers, same as every other stacked surface.

**Two id collisions found and fixed** — worth remembering, because `getElementById` picks one
silently and the failure looks like unrelated breakage:

- The new card button was `id="bpOvl"`, which the **policy editor already used** for its
  in-drawer overlap panel. `e2e.js` started reading the button instead of the panel. The
  button is now `bpOvlOpen`.
- `renderDefaultCis()` (added earlier today) reused `rtDClose`/`rtDScrim` from the
  default-policy **edit** drawer. Mutually exclusive branches today, so it worked — renamed to
  `rtDcClose`/`rtDcScrim`/`rtDcDone` anyway.

A duplicate-id sweep over the file now reports only `licEmptyAdd`, which is genuinely two
mutually exclusive empty states in the Licensing tabs.

## BOM Licensing — the readings are a decomposition cascade (2026-08-12)

The four-tab metric strip, its four panels (trend / source split / sync bands / rules) and
the three table tabs are **all deleted**. In their place: three cards that break down one
number, and card segments that filter the table in place.

```
128 licensed seats
├─ 102 consumed            ← card 1 (headline shows 26 available)
│   ├─ 90 agent-scanned    ← card 2 splits the 102 by scan method
│   └─ 12 manually ingested
└─  26 available

the same 102, by enrolment method:  ← card 3
├─ 57 by rule  ├─ 33 by hand  └─ 12 ingested
```

**Sums close by construction.** `LIC_SEGS` defines every segment's words, predicate and
colour in one place, and both breakdowns are `ENROLLED_CIS.filter(...)` over the same
in-memory snapshot — there is no second query to disagree with the first. `kpitest.js`
asserts 90+12=102 and 57+33+12=102, and re-asserts them after an enrol and a remove.

**Two dimensions, never merged.** `scanOf(c)` (agent | ingest) and `enrolOf(c)`
(rule | hand | ingest) are separate predicates. The old merged three-value
`ENROL_TYPES` / "Enrollment Type" column is gone; the table now carries **Scan** and
**Enrolled via** as separate columns, so every card segment has exactly one cell to point
at. `hand` is agent-only by predicate — the bug that conflated a manually enrolled agent CI
with a manually ingested one cannot recur.

**Cards.** `.lcards` grid, `.lcard` (14px radius, 17/18px padding, header = 16px icon +
13.5px title). Card 1: available count at 30px, `seatBarHTML()` — one segment per seat up to
40 seats, a proportional 30 past that — with the fill inheriting the card's state colour.
Thresholds are **percentages** (`(left/total) <= 0.25` amber, 0 red with "enrollment
blocked"), so they hold from an 8-seat demo to the 128-seat estate. Card 3: `donutHTML()`,
three arcs with rounded caps and an 11px gap; Ingested reuses card 2's cyan because it is the
same population seen twice.

**Interaction.** Card 2's two splits, card 3's three legend rows and card 1's "All enrolled"
pill are all `<button data-licseg>` with `aria-pressed`, wired through **one** handler.
Radio behaviour: re-clicking the active segment, the chip's ×, or the pill all return to All.
`LIC_SEG` is the single filter; `licVisible()` is the single query, so a segment's number and
the rows it produces are the same call. The chip's number is `list.length` — the rows on
screen — so the card and the table cannot quote different totals.

**Removed with them:** `LIC_TAB`, `LIC_FILT`/`LIC_FILTERS`/`LIC_FOPEN` and the Filter
dropdown (three controls narrowing one list by one dimension), plus ~63 lines of now-dead
`.kstrip`/`.kmet`/`.pnl-`/`.trend`/`.split-` CSS. "Manage rules" moved into the toolbar,
where it is always reachable rather than living on one tab.

### Revision — percentage headline, agent-only mix, tabs restored (same day)

**Card 1 leads with the percentage.** `80%` / "of 128 seats consumed"; both counts stay in
the footer (`102 consumed · 26 available · running low`), so nothing is lost to the
proportion. The card is named for the pressure, and pressure is a ratio.

**Card 3 decomposes the AGENT-SCANNED 90, not the enrolled 102.** "By rule" and "by hand"
are ways an *agent* CI came to hold a seat; an ingested CI has no agent to be swept in by,
so it is a leaf of card 2 rather than a slice of card 3. Two arcs, `57 + 33 = 90`, centre
reads 90, legend header "how the 90 agent-scanned got enrolled". The `ingest` segment is
still reachable — from card 2, which is where it belongs.

**The tabs are back, as the SAME state the cards drive.** `LIC_TABS` = all / agent / ingest,
the top level of the cascade. `licTabOf(k)` maps `rule`/`hand` to the `agent` tab, so
choosing "By rule" on card 3 selects Agent-scanned and shows `By rule · 57 ×` as a chip;
the chip's × steps back to the parent tab rather than all the way out. One `LIC_SEG`, one
`licVisible()`, two surfaces displaying it — there is no second filter to disagree with.
The row count moved to the toolbar as "N shown".

**A CSS class collision, found by the screenshot.** The seat bar was `.seatbar`, which the
rule drawer's seat-impact block already owned — and that rule comes LATER in the sheet, so
it won: `padding:11px 20px; background:var(--sel-blue)` turned the bar into a blank padded
strip with no visible segments. Renamed to `.lbar` / `.lbar i` rather than reordering, since
two unrelated things should not share a class and depend on source order to stay apart.
`kpitest.js` now asserts `.lbar` is defined exactly once and carries no foreign padding.
(This is the third such collision today, after `bpOvl` and `rtDClose`.)

**Not done, needs your call:** the spec says the table keeps "the existing status column
where inactive/stale agents surface". There is no Status column — it was removed at your
request earlier today ("every row on this page holds a licence seat"). Staleness currently
surfaces only through **Last seen**. Say the word and it comes back as a filterable column.

`kpitest.js` (cards + taxonomy) and `alltab.js` (segment/table agreement) were rewritten for
this; the old tab-driven versions are gone. Ten other suites had their `[data-lictab="auto"]`
clicks dropped, since "Manage rules" is now always in the toolbar.

## BOM Licensing — the three cards, visual polish pass (2026-08-12)

Structure, data and filter behaviour are unchanged from the cascade above; this pass is
execution only. Every v3 behaviour was regression-checked and still passes.

**Card 1 — one smooth bar.** The 30-tick bar was quantising the proportion: the eye counted
rectangles and rounded to the nearest one, so 80% read as "24 of 30". Now a single 8px
track (`--line-tbl`), fully rounded, with one fill whose `width` **is** the percentage and
whose gradient carries the state (brand / amber / red). The page already owned this idiom
(`.sevrow .tr` + `.tr i`), so the bar borrows it rather than inventing a second one. The
`aria-label` now states the percentage too ("102 of 128 seats consumed, 80 percent").
No load animation: `renderLicensing` replaces the node via `innerHTML`, so a CSS width
transition would never fire — adding one would have been dead code.

**Card 2 — left-accent segments.** The outer border drew a box around each half and made
two readings of one number look like two separate objects. Now: no outer border, a 2.5px
left accent, `border-radius:0 8px 8px 0`, and a 6% wash of that segment's own colour
(12% hover, 16% + a 34% inset ring when pressed). The colour arrives as **one** inline
custom property `--c`, so accent, tint and ring cannot fall out of step — the old markup
set `border-left-color` inline while the background was hard-coded white.

**Card 3 — the legend was wearing the toggle switch.** `.sw` is this page's on/off control
(36×20 with a white knob drawn by `.sw::after`). The legend swatch reused the name and
overrode only width/height/radius, so `::after` still applied: every marker rendered as a
9px box with a 16px white knob spilling out of it. That is the "radio-style, partially
filled circle" on screen. Renamed to `.lrow .dot` — 8px, solid, round — exactly as `.lbar`
was renamed for the same reason. **The real toggle switch is untouched**, and the test
asserts both halves of that.
⚠️ `.sevrow .sw` (line ~1086, severity rows) has the **identical latent bug** — an 8px dot
inheriting the switch knob. Left alone: out of scope for this prompt. Worth a one-line fix.

Also on card 3: the legend was `flex:1` and stretched to the card edge, so label and value
sat at opposite ends of a dead gap — now bounded to `flex:0 1 176px` with the value
right-aligned *inside* the legend. Rows gained a hairline separator (last row borderless),
12.5px label / 13px tabular value. Arcs thickened 9→12 (R 34→33 so they stay inside the
88px box), and the centre number moved from SVG `<text>` to an overlaid `.don-n` span, which
inherits the page font stack and tabular figures instead of restating them as SVG attributes.

**Card 3 footer — exception first, and a link that always exists.** `.kpi-lnk` was **never
defined anywhere in the sheet**, so it rendered as a raw UA button — that is the "boxed chip
that reads as disabled". Replaced with `● 1 rule disabled · 3 of 4 enabled … Manage`
(`.ldot` amber glyph, `.llnk` borderless accent link). When nothing is disabled: muted
"All 4 rules enabled", no dot, **link stays** — you go to the rules to change them, not only
when something is wrong. `#licRulesLink` therefore binds unconditionally now.

**Two alignment bugs caught in verification, not on screen:**
- `.lc-foot{min-height:26px}` is wrong under `*{box-sizing:border-box}` — the 12px
  `padding-top` eats into it and leaves a 14px band, so card 2 (empty footer) would have
  ended **12px above** cards 1 and 3. Floor is now `38px` = padding + control height, and
  the test derives that sum from the sheet rather than hard-coding it.
- `.lcards` was a fixed `repeat(3,1fr)` with no breakpoints, so the cards squeezed instead
  of reflowing and "verify at 2-col/1-col" had nothing to verify. Now collapses to 2 at
  1280px and 1 at 860px, following `.kpis`' existing 1280 breakpoint rather than inventing
  a second set. Bottom alignment is breakpoint-independent by construction
  (`.lcard` column flex + `.lc-foot{margin-top:auto}`).

Verified in `kpitest.js` (53 checks): bar at **0 / 80 / 100%** driven through real state
with the snapshot restored afterwards; legend values at 1-digit and 3-digit; the switch
kept while the legend detaches; footer floor ≥ padding + control. jsdom has no layout
engine, so bottom alignment and reflow are asserted as **rules**, not measured pixels.
`pager.js` had one assertion pinned to the old footer wording ("rules enabled") — rewritten
to assert the ratio and the route to it, not one sentence. All 19 suites pass.

## BOM Licensing — the cards fill their height (2026-08-12)

Spacing only; no copy, data or behaviour changed.

The two screenshots that prompted this were **the same code at different breakpoints** —
2-column (which looked right) and 3-column (which looked squat, with dead space). The cause:
the grid stretches all three cards to the tallest, but every body was a fixed height, so the
whole difference came out as one gap above the footer. Each body is now the flexible child
(`.lsplit`/`.lmix{flex:1}`), so the spare height goes **into** the content: card 2's two
panels grow and centre their contents, card 3's donut and legend sit centred in what they
are given. Card 1's bar stays under the sub-label it explains, which is where the 2-column
reference puts it too.

`.lc-foot:empty{display:none}` — card 2 has nothing to say at the bottom, and the empty 38px
band it was reserving *was* the gap under its panels. It now ends at its padding.

Also: card padding 17/18 → **20/22**, grid gap 14 → **16** (matches `.kpis`), bar 8 → **9px**,
body offset 14 → **16px**, `.lseg` padding 9/12 → **12/14** with `min-height:76px` on the row.
One test had pinned the bar's radius at 4px; it now derives "fully rounded" from the sheet
(radius ≥ half the height, fill matching track) so growing the bar can't fail it again.

## Read first
CLAUDE.md `## Key context` → the three **BOM** bullets (BOM tab on the Endpoint detail page, BOM sub-screens, BOM data), plus the **BOM** entry under `## Structure`. The V2 rule still stands ("version 2" feature asks → `TicketDrawerV2.tsx` only).

## What we worked on this session
Two things: (1) the project was set up to run locally and published to a new GitHub repo; (2) the **BOM module** was designed and built — listing + detail, modelled on the reference implementation at <https://zenichakalasiya.github.io/serviceops-bom/>.

## Completed
- **Repo + deploy**: `pnpm` activated via corepack, `pnpm install` / `pnpm dev` / `pnpm build` all clean. Published to **<https://github.com/zenichakalasiya/serviceops-ticket-detail>** (public), live at **<https://zenichakalasiya.github.io/serviceops-ticket-detail/>** via the existing Actions workflow. `vite.config.ts` `base` was repointed from `/ServiceOps-Ticket-Detail-/` to `/serviceops-ticket-detail/`.
  - ⚠️ The repo `serviceops-bom` already existed on that account holding a DIFFERENT project ("ServiceOps module replicas"); it was left untouched and a new repo name was used instead.
- **BOM module — listing**: `BomInventoryListPage` + `BomInventoryTable`, route `'bom'`, sidebar icon (`IconBom`, lucide `Layers`) directly below Vulnerability. Agent CIs / Managed CIs pills, Ingest BOM CTA, BOM-specific columns.
- **BOM module — detail**: `EndpointBomTab` added to the existing `EndpointDrawer` as tab `bom`. Opened from the BOM listing the drawer LANDS on that tab (`bomMode` flag on the adapted record); opened from Patch/Vulnerability it still lands on Overview.
- **Sub-screens**: components grid (`BomComponentsPage`, three column sets), `BomCompareVersionsModal`, `BomScanPathsPanel`, `BomScanRunsPanel`, inline download-format popover.
- **CBOM + AI BOM component tables were designed** (the reference left both as placeholders). **Managed CIs is a deliberate empty state**, per the same decision.
- **`bomData.ts`**: deterministic per-endpoint BOM data with every count derived from one source (see the CLAUDE.md bullet).

## In progress
Nothing mid-flight.

## Next steps
- The BOM work is **committed locally but NOT pushed** — it has not been deployed to the live URL yet.
- Optional: a BOM Info group in the endpoint's right-hand properties rail. `BomInfoPanel` is written and exported from `EndpointBomTab.tsx` but is **not yet mounted** anywhere — `TicketPropertiesPanel` would need a `bomMode`-style prop threaded through, the same pattern the patch/endpoint modes use.
- Optional: wire the listing's Findings count through to the Vulnerabilities tab so a finding opens its CVE.
- Optional: the "Ingest BOM" CTA and the components-page Export are toast-only.

## Decisions made
- The BOM listing gets **BOM-specific columns** rather than reusing the Endpoints columns — the module's whole point is what the BOM contains.
- BOM is **a tab on the existing endpoint drawer**, not a second 8k-line drawer clone; the landing tab is what differs by entry point.
- The CBOM table is genuinely NOT an SBOM table with different labels — an algorithm has a primitive, key length, protocol and post-quantum posture, and no ecosystem or PURL.
- Component counts are cycled from a 40-entry catalog with version bumps rather than being faked, so "View components · 183" really lists 183 rows.

## Gotchas & notes
- Adding a tab to `EndpointDrawer` needs **four** edits, not three: `allTabs`, `tabWidths`, `tabLabels`, and the `tabConfig` array inside the tab-strip IIFE (`allowedTabIds` filters the strip — miss it and the tab silently never renders).
- The landing-tab effect must read `activePatchRecord`, not `activeAsset` — `patchToAssetShape()` drops fields it does not know about.
- A `<button>` inside a `text-[12px]` `<td>` does NOT inherit that size here; put the size on the button. `EndpointsTable.tsx` still has this (host names render at 16px) — left alone as it is outside this task's scope.
- `vite build` does NOT typecheck (the build script is bare `vite build`), so type errors compile through silently. Verify behaviour in the browser, not just by building.
- `pnpm` is not on PATH by default on this machine; `corepack prepare pnpm@10 --activate` fixes it. `npm install` still crashes on this pnpm-managed tree.
