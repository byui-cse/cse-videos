# cse-videos
Video Library Website for the CSE Department

Students and faculty can find, watch, and share the department's videos. Search by text or tag, browse the tag directory, open any video on its own page, and copy a link to a search, a tag, or a single video.

## Run it locally

Needs Node 20 or newer.

```sh
npm install
npm run dev
```

The site runs at http://localhost:5190 and rebuilds whenever you save a file. Refresh the page to see the change.

| Command | What it does |
| --- | --- |
| `npm run dev` | Builds the site, serves it, and rebuilds on save |
| `npm run build` | Builds the site into `dist/` |
| `npm run validate` | Checks `data/videos.json` and `data/tags.json` and lists any problems |
| `npm test` | Runs the tests |
| `npm run test:e2e` | Runs the browser tests in headless Chromium (run `npx playwright install chromium` once first) |

## Pages and links

Everything is in the address, so any view can be shared by copying the link.

| Address | Shows |
| --- | --- |
| `/` | Every video, newest first, with search |
| `/?q=portfolio` | A search. Every word typed has to match the start of a word in the title, description, tags, or credits. Plurals and -ing forms count, so "jobs" finds "job" and "interviewing" finds "interview". |
| `/?sort=oldest` | Oldest first. Works on the home page and on tag pages. |
| `/tags/` | Every tag and how many videos have it |
| `/tags/portfolio/` | The videos with one tag |
| `/videos/career-quest-part-1/` | One video and its player |
| `/videos/career-quest-part-1/?source=instagram` | The same video, playing from Instagram instead of YouTube |

## Adding a video

1. On github.com, open [`data/videos.json`](data/videos.json) and click the pencil. Paste the template below right after the opening `[`, including its trailing comma, then replace the example values. The site sorts by date, so position in the file does not matter.
2. Commit the edit to a new branch. On that same branch, open `src/covers/` and use **Add file > Upload files** to add a 480×750 JPEG under 150 KB named `<id>.jpg`. On a Mac, resize with `sips -z 750 480 in.jpg --out <id>.jpg` (replace `<id>` with the video's id), then check the file size.
3. Open a pull request from your branch. The checks run on their own. If you see a red X, click **Details** to read what needs fixing, then edit the files on the same branch.

```json
{
    "id": "career-quest-part-1",
    "title": "Career Quest, Part 1: Every job hunt needs three things",
    "description": "The caption from the Instagram post.",
    "instagram": "https://www.instagram.com/reel/POST_CODE/",
    "length": "1:05",
    "datePosted": "2026-10-19",
    "tags": ["career-quest", "job-search"],
    "series": "career-quest",
    "part": 1
},
```

Use a unique id and reel link. For a standalone video, remove both `series` and `part`.

| Field | Required | Format |
| --- | --- | --- |
| `id` | Yes | Unique lowercase words joined by hyphens; used in the video's link, so don't change it once live. |
| `title` | Yes | The video's title. |
| `description` | No | The Instagram caption without hashtags; write `\n` for a line break or `\n\n` for a new paragraph. |
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

Every tag must be listed in [`data/tags.json`](data/tags.json). Reuse an existing id whenever possible. To introduce a new tag, add its id and display name there in the same pull request.

## Deploying

Every push to `main` runs the data checks and unit tests, then deploys the site to GitHub Pages. Pull requests run those checks plus the browser tests (`npm run test:e2e`), without deploying.

One-time setup for a repo admin: Settings > Pages > Build and deployment > Source: **GitHub Actions**.

## How it's put together

- `data/` holds the videos and tag names.
- `lib/render.js` writes every page as plain HTML at build time, so pages load fast, work without JavaScript, and show a title and cover when a link is shared. `lib/site.js` sorts, counts tags, and formats dates; `lib/videos.js` checks the data.
- `src/js/` adds search, sorting, copy link, and the player controls in the browser. `src/js/search.js` is shared with the build, so search matches the same words everywhere.
- `src/css/` follows the [CS & SE site](https://github.com/byui-cse/byui-cse.github.io): the same color, type, and spacing tokens, base styles, and buttons. The build bundles it into one file with [Lightning CSS](https://lightningcss.dev/).
- Unit tests are in `test/` (`npm test`). Browser tests are in `e2e/` (`npm run test:e2e`).
- Fonts are Source Sans 3 and Source Serif 4 (SIL Open Font License), from Fontsource.
