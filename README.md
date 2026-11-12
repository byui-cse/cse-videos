# cse-videos
Video Library Website for the CSE Department

Students and faculty can find, watch, and share the department's videos. Search by text or topic, browse the topics, open any video on its own page, and copy a link to a search, a topic, or a single video.

## Run it locally

Needs Node 20.9 or newer.

```sh
npm install
npm run dev
```

The site runs at http://localhost:5190 and rebuilds whenever you save a file. Refresh the page to see the change.

| Command | What it does |
| --- | --- |
| `npm run dev` | Builds the site, serves it, and rebuilds on save |
| `npm run build` | Builds the site into `dist/`, including smaller copies of the covers |
| `npm run validate` | Checks `data/videos.json` and `data/tags.json` and lists any problems |
| `npm test` | Runs the tests |
| `npm run test:e2e` | Runs the browser tests in headless Chromium (run `npx playwright install chromium` once first) |

## Pages and links

Everything is in the address, so any view can be shared by copying the link.

| Address | Shows |
| --- | --- |
| `/` | The headline and the search beside a card holding every video's still, then every video newest first, the topics, and Career Quest. A search lights the matching stills in the card and brings them to its front rows. On a phone the list opens on its first 13 videos with a button for the rest; a search always looks through all of them. |
| `/wall/` | The Video wall: every video's still in small columns at least a screen tall, with the search in a strip that stays at the foot of the screen as the wall scrolls. On a screen 480 px tall or less, like a phone held sideways, the strip comes first instead. A search lights the stills that match and dims the rest; Enter goes to the first match. A video opened from here links back to the wall, or to its search. |
| `/wall/?q=portfolio` | The Video wall with that search lit |
| `/?q=portfolio` | A search. Every word typed has to match the start of a word in the title, description, tags, or credits. Common plurals and -ing or -ed forms count, so "jobs" finds "job", "getting" finds "get", and "coding" finds "code". |
| `/?sort=oldest` | Oldest first. Works on the home page and on topic pages; a series is always in part order. |
| `/tags/` | Every topic, the most used first, with how many videos it has and how long they run |
| `/tags/portfolio/` | The videos on one topic. A series, like Career Quest, is in part order, with a button to start at Part 1. |
| `/videos/career-quest-part-1/` | One video and its player |
| `/videos/career-quest-part-1/?source=instagram` | For a video on both YouTube and Instagram, the same video playing from Instagram instead of YouTube. A video with one player drops `?source=` from the address, so a copied link carries only what plays. |

Pressing YouTube or Instagram above a video, or in the "Play videos on" switch in the blue bar at the top (shown once any video has both links), also sets a soft preference: later videos open on that player when they have it, and a video on only the other one plays there with a short "Only on Instagram" or "Only on YouTube" note. The preference is kept in this browser only and is never added to the address, so a shared link with `?source=` still opens on the player it names.

## Adding a video

1. On github.com, open [`data/videos.json`](data/videos.json) and click the pencil. Paste the template below right after the opening `[`, including its trailing comma, then replace the example values. The site sorts by date, so position in the file does not matter.
2. Commit the edit to a new branch. On that same branch, open `src/covers/` and use **Add file > Upload files** to add a 480×750 JPEG under 150 KB named `<id>.jpg`. That one file is all a video needs; the build makes the smaller copies the pages use. On a Mac, make one from a still of the reel (JPEG, PNG or HEIC, taller than 480:750 as reel frames are) with `sips -s format jpeg --resampleWidth 480 -c 750 480 still.png --out <id>.jpg`, replacing `still.png` with your file and `<id>` with the video's id. It scales the still to 480 wide and trims the top and bottom to 750.
3. Open a pull request from your branch. The checks run on their own. If you see a red X, click **Details** to read what needs fixing, then edit the files on the same branch.

```json
{
    "id": "career-quest-part-1",
    "title": "Career Quest, Part 1: Every job hunt needs three things",
    "description": "The caption from the Instagram post.",
    "instagram": "https://www.instagram.com/reel/POST_CODE/",
    "length": "1:05",
    "datePosted": "2026-10-19",
    "series": "career-quest",
    "part": 1,
    "tags": ["career-quest", "job-search"]
},
```

Use a unique id and reel link. For a standalone video, delete the `series` and `part` lines.

| Field | Required | Format |
| --- | --- | --- |
| `id` | Yes | Unique lowercase words joined by hyphens; used in the video's link, so don't change it once live. |
| `title` | Yes | The video's title. |
| `description` | No | The Instagram caption without hashtags; write `\n` for a line break, `\n\n` for a new paragraph, and `\"` for a double quote. |
| `instagram` | Yes, unless using YouTube | An https Instagram post or reel link. |
| `length` | No | `m:ss` or `h:mm:ss`. |
| `attributions` | No | A list of credits; links may use `[text](https://url)`. |
| `datePosted` | Yes | `YYYY-MM-DD`; lists sort by this date. |
| `dateCreated` | No | `YYYY-MM-DD`. |
| `tags` | Yes | A list of tag ids from [`data/tags.json`](data/tags.json). |
| `series` | With `part` | A lowercase slug for videos in a series, like `career-quest`. It must also be one of the video's tags. |
| `part` | With `series` | A whole number starting at 1. Each part appears once, with no gaps. |
| `stats` | No | Counts, like `{ "newPeople": 3, "projects": 1 }`. |

Optional: add a `youtube` field with an https YouTube video link (watch, youtu.be, or shorts). With both links, the page plays YouTube and offers an Instagram switch. A YouTube video may omit the cover; the site uses its thumbnail.

The current covers are stills taken from each reel, saved at 480×750.

### Tag names

Tags are shown on the site as topics. Every tag must be listed in [`data/tags.json`](data/tags.json). Reuse an existing id whenever possible. To introduce a new tag, add its id and display name there in the same pull request.

## Deploying

Every push to `main` runs the data checks and unit tests, then deploys the site to GitHub Pages. Pull requests run those checks plus the browser tests (`npm run test:e2e`), without deploying.

One-time setup for a repo admin: Settings > Pages > Build and deployment > Source: **GitHub Actions**.

## How it's put together

- `data/` holds the videos and tag names.
- `lib/pages/` writes every page as plain HTML at build time, so pages load fast, work without JavaScript, and show a title and cover when a link is shared: `home.js`, `video-wall.js`, `video.js`, `tags.js` (the topics and each topic), `not-found.js`, and `layout.js` and `parts.js` for what they share. `lib/render.js` gathers them for the build. Every value from the data goes through `lib/html.js`, which escapes it. `lib/site.js` sorts, counts tags, adds up running times, and formats dates; `lib/related.js` finds a video's series parts and related videos; `lib/wall.js` arranges the walls: the shuffle, the card's order (covers without a face stay out of its front rows), the copies that fill the Video wall (a row of them first, since that row is lifted past the top edge) and a short list's card, and the Video wall's row counts, which the build adds to the stylesheet so the wall is always tall enough to show every video whole; `lib/videos.js` checks the data.
- `lib/images.js` makes AVIF and WebP copies of each cover at 240, 360 and 480 pixels wide with [sharp](https://sharp.pixelplumbing.com/), and every still offers them through `srcset` and `sizes` with the JPEG as the fallback. The copies are written into `dist/` and cached in `node_modules/.cache/`, named by the cover's contents and every setting that shapes them, so a rebuild only makes copies of new or changed covers, or all of them after a setting changes. They are never committed.
- `src/js/` adds search, sorting, the link buttons, and the player controls in the browser, starting from `main.js`. `src/js/search.js` is shared with the build, so search matches the same words everywhere. `motion.js` is the only motion that runs on its own: Career Quest's boards fade up once. Everything else responds to a pointer, a key, or a click: a still on a wall lights up and is named in one label (under the card, or in the Video wall's strip, which on a touch screen names the focused still; `wall.js`, which also runs the Video wall's search), stills in the grid zoom slightly inside their frames, Career Quest's boards lift with a gold edge, and the still you click carries into the next page's player (`transition.js`, a cross-document view transition). With reduced motion turned on, nothing moves; the short fades on the wall stay.
- The wall in the home page's card is for the pointer. Every video on it is also in the list below, so its links are left out of the tab order and hidden from screen readers. On the Video wall each video's own still is a link named by its title, after the search in the tab order; the copies that fill the rest of the screen are hidden from screen readers and the keyboard, and during a search so are the videos that don't match.
- `js/main.js` holds the first paint until it has run (`blocking="render"`), with every module it imports preloaded beside it. Without that, Chromium paints a page while its modules are still loading and drops the page-to-page view transition with an error.
- `src/css/` is the design in cascade layers (tokens, base, layout, components, utilities): BYU-Idaho blue utility bar over a white header, a home hero in the manner of the department's CS & SE site (a blue gradient under a faint grid, the second line of the headline in gold, the wall in a framed card), navy bands, a blue footer, square stills, and 4 px corners on controls, in the CS & SE colors. The build bundles it into one file with [Lightning CSS](https://lightningcss.dev/). Light and dark follow the device.
- Pages carry a strict Content Security Policy: no inline styles, and no inline scripts except the one on Instagram video pages, which the policy allows by its hash.
- Unit tests are in `test/` (`npm test`). Browser tests are in `e2e/` (`npm run test:e2e`).
- `src/favicon.svg` is a placeholder icon, the letters CSE in white on navy, until the department supplies a mark.
- Fonts are Sofia Sans and Sofia Sans Semi Condensed (SIL Open Font License, licenses in `src/fonts/`), self-hosted variable WOFF2 files from Fontsource, latin only. Until they load, text is set in the device's Arial, Liberation Sans or Arimo, resized to the same widths and heights (`src/css/base/fonts.css`), so on a device with one of those nothing moves when they arrive.
