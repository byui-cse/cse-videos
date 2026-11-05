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

## Pages and links

Everything is in the address, so any view can be shared by copying the link.

| Address | Shows |
| --- | --- |
| `/` | Every video, newest first, with search |
| `/?q=portfolio` | A search. Every word typed has to match the start of a word in the title, description, tags, or credits. |
| `/?sort=oldest` | Oldest first. Works on the home page and on tag pages. |
| `/tags/` | Every tag and how many videos have it |
| `/tags/portfolio/` | The videos with one tag |
| `/videos/career-quest-part-1/` | One video and its player |
| `/videos/career-quest-part-1/?source=instagram` | The same video, playing from Instagram instead of YouTube |

## Adding a video

1. Add an entry to [`data/videos.json`](data/videos.json).
2. Add its cover to `src/covers/`, named after its id: `src/covers/career-quest-part-1.jpg`. A video with a YouTube link can skip this; the site uses YouTube's thumbnail.
3. Run `npm run validate`, then open a pull request.

```json
{
    "id": "career-quest-part-1",
    "title": "Career Quest, Part 1: Every job hunt needs three things",
    "description": "The caption from the Instagram post.",
    "youtube": "https://www.youtube.com/shorts/VIDEO_ID",
    "instagram": "https://www.instagram.com/reel/POST_CODE/",
    "length": "1:05",
    "datePosted": "2026-10-19",
    "tags": ["career-quest", "job-search"]
}
```

| Field | Required | Format |
| --- | --- | --- |
| `id` | Yes | Lowercase words joined by hyphens. Used in the video's link, so don't change it once it's live. |
| `title` | Yes | Text |
| `description` | No | Text. Blank lines start a new paragraph. |
| `youtube` | One of the two links | A YouTube video link (watch, youtu.be, or shorts). Shorts play in a tall player. |
| `instagram` | One of the two links | An Instagram post or reel link |
| `length` | No | `m:ss` or `h:mm:ss` |
| `attributions` | No | A list of text, for music or content credits |
| `datePosted` | Yes | `YYYY-MM-DD`. Lists are sorted by this date. |
| `dateCreated` | No | `YYYY-MM-DD` |
| `tags` | Yes | A list of lowercase words joined by hyphens |
| `stats` | No | Counts, like `{ "newPeople": 3, "projects": 1 }` |

When a video has both links, its page plays YouTube and offers a switch to Instagram, where viewers can see likes and comments.

### Tag names

A tag's name is its id spelled out: `job-search` shows as "Job search". When that isn't right, give it a name in [`data/tags.json`](data/tags.json):

```json
{
    "ai": "AI",
    "career-quest": "Career Quest"
}
```

Run `npm run validate` before you push. The build runs the same checks, so a mistake fails the deploy instead of breaking the live site.

## Deploying

Every push to `main` runs the checks and deploys the site to GitHub Pages. Pull requests run the same checks without deploying.

One-time setup for a repo admin: Settings > Pages > Build and deployment > Source: **GitHub Actions**.

## How it's put together

- `data/` holds the videos and tag names.
- `lib/render.js` writes every page as plain HTML at build time, so pages load fast, work without JavaScript, and show a title and cover when a link is shared. `lib/site.js` sorts, counts tags, and formats dates; `lib/videos.js` checks the data.
- `src/js/` adds search, sorting, copy link, and the player controls in the browser. `src/js/search.js` is shared with the build, so search matches the same words everywhere.
- `src/css/` follows the [CS & SE site](https://github.com/byui-cse/byui-cse.github.io): the same color, type, and spacing tokens, base styles, and buttons. The build bundles it into one file with [Lightning CSS](https://lightningcss.dev/).
- Tests are in `test/`.
- Fonts are Source Sans 3 and Source Serif 4 (SIL Open Font License), from Fontsource.
