# CSE Videos: project plan

A video library for the reels on the department Instagram, [@byui.cse](https://www.instagram.com/byui.cse/). A teacher finds the right reel in seconds, copies a link, and sends it to a student who needs some inspiration. The goal is a site polished enough to live on the department's official domain.

- **Stakeholder:** Brother Crosby
- **Builder:** Levi Mackay, wearing every hat a real web team would
- **Direction:** B, matched to the look of byui.edu

## Who it's for

1. **Teachers.** They search or browse, copy a link, and send it in a Canvas message, an email, or a slide.
2. **Students who get a link.** They open it on a phone and watch right away, with no login.
3. **The department.** Crosby or a TA adds a new reel in a couple of minutes, with no code.

## Direction B

B uses byui.edu's own visual language, so the library feels like part of the university site rather than a side project.

### Design tokens

| Token | Value | Use |
| --- | --- | --- |
| Blue | `#006eb6` | Brand color, buttons, the hero panel, the Career Quest band |
| Deep blue | `#005a95` | Hover and pressed states |
| Sky | `#9bd5fd` | Accents on blue, focus rings |
| Ground | `#f5f5f5` | Page background |
| Card | `#ffffff` | Header, filter bar, video sheet |
| Ink | `#141414` | Headings, footer |
| Text | `#333333` | Body |
| Muted | `#656565` | Meta, counts, dates |

These colors come from byui.edu's live stylesheet.

**Type.** byui.edu uses Acumin Pro, with the semi condensed width for headlines. The prototype uses Archivo, a free font with a width axis, as a stand in: about 87% width for headlines and 100% for body text. If the site moves onto the official domain, ask whether the university's Acumin license covers it.

**Shape and spacing.** Pill buttons and inputs, as on byui.edu. 12px radius on video covers. Spacing on an 8px grid.

### Page structure

1. **Utility bar** in blue: the department name, plus a link to @byui.cse.
2. **Header:** the "CSE Video Library" wordmark, Topics, Career Quest, and a Browse videos button.
3. **Hero:** a slowly moving wall of real reel covers, with a blue panel holding the headline, one line of copy, a search box, and quick links to each topic.
4. **Sticky filter bar:** topic tabs with counts, search, and sort (newest, oldest, in order). It sticks only while the library is on screen.
5. **Library:** one sideways row per topic when nothing is filtered. A results grid when a topic or search is active.
6. **Career Quest feature:** a blue band that pins while you scroll and steps through parts 1 to 5.
7. **Video sheet:** a panel that slides up with the player, title, caption, Copy link, Email to a student, Open on Instagram, and more from the same topic.
8. **Video pages:** each reel also gets its own URL with a share card, so a pasted link shows the cover and title.
9. **Footer:** the department name, the Instagram link, and a link to the department site.

### Motion spec

| Moment | What happens | Timing |
| --- | --- | --- |
| Page load | The wall scales in, the panel rises, and the headline lines reveal one at a time | About 1.6s total, power4.out |
| Hero idle | Columns drift up and down at different speeds | 70 to 106s per loop, linear |
| Hero scroll | The wall zooms slightly and the panel drifts up | Tied to scroll |
| Rows enter | Cards slide in from the right, once | 0.9s, 0.05s stagger |
| Filtering | Cards move to their new spots (GSAP Flip) instead of blinking | 0.6s, power3.inOut |
| Career Quest | Scroll steps through the five parts and snaps to each one | Pinned for about 2200px |
| Open a video | The sheet slides up and its text follows | 0.75s, expo.out |
| Copy link | The button confirms with a small bounce | 0.5s |

Rules: animate only transform and opacity. Nothing waits on an animation before showing content. With reduced motion turned on, everything appears in place, nothing moves on its own, and Career Quest becomes a plain row.

### Fix during the build

A design review of the prototype flagged these:

- [ ] Curate the hero wall. No repeated faces next to each other, and no captions cut mid word. Covers pulled from the original video files would solve most of it.
- [ ] Replace Instagram's embed frame, which clashes with the palette, if self hosting is approved (question 1 below).
- [ ] Fill the empty space in the video sheet on wide screens: a longer description or a transcript, plus larger related videos.
- [ ] Phones: tabs scroll sideways but need a clear cue, and dates shouldn't wrap.
- [ ] On desktop, test a centered dialog against the bottom sheet and keep whichever teachers find faster.

## Content

- 40 reels on @byui.cse as of October 28, 2026. 36 belong in the library. Two t-shirt posts, the STC bug hunt, and one reel with no caption are left out.
- Draft topics and counts: Student projects (6), Getting hired (18), Student stories (4), Finding your way (8).
- Career Quest is a five part series inside Getting hired and keeps its own order.
- Titles were drafted from each reel's caption. Crosby should review them.
- Every entry holds: Instagram code, title, topic, date, caption, series and part if any, cover, and a slug for its URL.

### Adding a reel

1. Add one entry with the title, topic, date and Instagram link.
2. Add the cover image, or let a script pull a frame from the video file.
3. Open a pull request. The build checks the entry and makes a preview.

## How we work

Run like a small web team, even with one person.

| Role | Owns |
| --- | --- |
| Product | Scope, priorities, the weekly demo with Crosby |
| Design | Tokens, components, motion spec, design reviews |
| Front end | Astro components, search and filters, animation |
| QA | Unit tests, end to end tests, accessibility, real devices |
| DevOps | CI, preview deploys, releases |

- **Issues and a board.** Every task is a GitHub issue on a project board (Backlog, This week, In progress, In review, Done), grouped into the milestones below.
- **Branches and pull requests.** `main` is protected. Each change lands through a PR with a description and a passing build.
- **CI on every PR.** Build, typecheck, lint, unit tests, end to end tests, accessibility checks, and Lighthouse.
- **Preview deploys.** Every PR gets a link that can be checked on a phone before merging.
- **Weekly demo.** Crosby's Monday 4pm TA sync is the review: show what shipped, ask one or two questions.
- **Decisions log.** One short file per decision in `docs/decisions/`, so "why is it like this" always has an answer.

## Tech stack

- **Astro:** static pages, content collections with a typed schema, one page per video, and image optimization.
- **TypeScript:** for content and components.
- **GSAP**, with ScrollTrigger and Flip: the motion.
- **Vitest and Playwright:** unit and end to end tests.
- **GitHub Actions and GitHub Pages:** CI and hosting inside the byui-cse org.

## Milestones

### M0: Kickoff
- [ ] Walk Crosby through the prototype and get answers to the open questions.
- [ ] Confirm the topics and the reel titles.
- [ ] Set up the project board, labels, and issue and PR templates.

### M1: Foundations
- [ ] Astro and TypeScript project, Prettier and ESLint.
- [ ] Design tokens and base styles.
- [ ] CI workflow and GitHub Pages deploy.
- [ ] Content collection with all 36 reels and their covers.

### M2: Library that works
- [ ] Header, hero, filter bar, topic rows, results grid, footer.
- [ ] Search, topic filter, and sort, with the state kept in the URL.
- [ ] Video sheet with Copy link and Email to a student.
- [ ] One page per video with a share card.

### M3: Motion and polish
- [ ] Hero wall and load sequence.
- [ ] Flip filtering and row entrances.
- [ ] Career Quest stepper.
- [ ] Reduced motion pass.

### M4: Quality
- [ ] Unit tests for search, filter, sort and slugs.
- [ ] End to end test of the teacher path: search, copy link, open the link on a phone sized screen.
- [ ] Accessibility: automated checks, a full keyboard run, a VoiceOver run.
- [ ] Performance: Lighthouse 90 or better on mobile, first image under 2.5s, no layout shift.
- [ ] Real devices: iPhone, Android, laptop, classroom projector.

### M5: Launch
- [ ] v1.0 release notes.
- [ ] README, plus `MAINTAINING.md` on how to add a reel.
- [ ] Demo to Crosby.

### M6: Department domain
- [ ] Find out who owns the department's web presence and what the path onto the domain is.
- [ ] Check the university's web and brand requirements.
- [ ] Add analytics only if the department approves, and keep them privacy friendly.

## Open questions for Brother Crosby

1. Where should the videos play: Instagram's embed (simplest, shows Instagram's frame), self hosted files (cleanest, needs storage), or unlisted YouTube?
2. Can we use the original video files for covers and short silent previews?
3. Do the four topics match how teachers think about these videos?
4. Should department news reels, like t-shirt day, be in the library?
5. Who should we talk to about moving onto the department domain?
6. Is the Monday sync a good time for a weekly demo?

## Risks

- **The Instagram embed** can change, shows Instagram's own frame, and may ask viewers to log in. Self hosting removes the risk.
- **Covers taken from the feed** carry burned in captions cut mid sentence. Covers from the original files fix this.
- **Upkeep.** If adding a reel is slow, the library goes stale. The two minute pipeline exists for this.
- **Motion and accessibility.** Constant movement can bother some people. Reduced motion support and a pause on the hero wall cover it.

## Definition of done

Every feature, before it counts:

- [ ] Matches the design tokens and the motion spec.
- [ ] Works with a keyboard and has visible focus states.
- [ ] Works at 390px and 1440px wide.
- [ ] Honors reduced motion.
- [ ] Has tests where there's logic.
- [ ] CI is green and the preview was checked on a phone.
- [ ] Merged through a PR whose description says why.
