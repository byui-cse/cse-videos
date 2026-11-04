# cse-videos
Video Library Website for the CSE Department

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
| `npm run validate` | Checks `data/videos.json` and lists any problems |
| `npm test` | Runs the tests |

## Adding a video

Every video is one entry in [`data/videos.json`](data/videos.json):

```json
{
    "id": "career-quest-part-1",
    "title": "Career Quest, Part 1",
    "description": "The caption from the Instagram post.",
    "youtube": "https://www.youtube.com/watch?v=VIDEO_ID",
    "instagram": "https://www.instagram.com/reel/POST_CODE/",
    "length": "1:05",
    "datePosted": "2026-10-28",
    "tags": ["career-quest", "getting-hired"]
}
```

| Field | Required | Format |
| --- | --- | --- |
| `id` | Yes | Lowercase words joined by hyphens. Used in the video's link, so don't change it once it's live. |
| `title` | Yes | Text |
| `description` | No | Text |
| `youtube` | One of the two links | A YouTube video link (watch, youtu.be, or shorts) |
| `instagram` | One of the two links | An Instagram post or reel link |
| `length` | No | `m:ss` or `h:mm:ss` |
| `attributions` | No | A list of text, for music or content credits |
| `datePosted` | Yes | `YYYY-MM-DD` |
| `dateCreated` | No | `YYYY-MM-DD` |
| `tags` | Yes | A list of lowercase words joined by hyphens |
| `stats` | No | Counts, like `{ "people": 3 }` |

Run `npm run validate` before you push. The build runs the same checks, so a mistake fails the deploy instead of breaking the live site.

## Deploying

Every push to `main` runs the checks and deploys the site to GitHub Pages. Pull requests run the same checks without deploying.

One-time setup for a repo admin: Settings > Pages > Build and deployment > Source: **GitHub Actions**.

## How it's put together

- `src/` holds the pages, styles, scripts, and fonts. The build copies it to `dist/` and bundles the CSS into one file with [Lightning CSS](https://lightningcss.dev/).
- `src/css/tokens/` and `src/css/base/` come from the [CS & SE site](https://github.com/byui-cse/byui-cse.github.io), so both sites share the same colors and type.
- `lib/videos.js` checks the video list. Its tests are in `test/`.
- Fonts are Source Sans 3 and Source Serif 4 (SIL Open Font License), from Fontsource.
