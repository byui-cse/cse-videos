# CSE Videos: project plan

A website where students and faculty find, watch, and share the department's videos. Brother Crosby's requirements are in issue #3.

- **Stakeholder:** Brother Crosby
- **Builder:** Levi Mackay

## Requirements (issue #3)

| # | Requirement | Status |
| --- | --- | --- |
| 1 | Search for a video by text or tag | Done. The home page search matches titles, descriptions, tags, and credits as you type. |
| 2 | Show the tag directory | Done. `/tags/` lists every tag with its count. |
| 3 | Show the videos with a given tag | Done. `/tags/<tag>/` |
| 4 | Watch the embedded video, expandable | Done. Each video has its own page; Expand fills the window without restarting the video. |
| 5 | Share a tag, search, or video by URL | Done. Search, sort, tag, video, and player choice all live in the address, and there is a Copy link button. |
| 6 | Videos and metadata in a JSON file in git | Done. `data/videos.json`, plus `data/tags.json` for tag names. |
| 7 | Update the site on push with GitHub Actions | Done. Waiting on a repo admin to turn on Pages (Settings > Pages > Source: GitHub Actions). |
| 8 | Play from YouTube or Instagram | Done. Videos with both links can switch between them; Instagram's player shows likes and comments. |
| 9 | Show videos in date order | Done. Newest first, with an Oldest first option. |
| Design | Use the CSS from the CS & SE site; works on computers and phones | Done. Same tokens, fonts, base styles, buttons, navy bands, and ruled lists. |

## Design

The site uses the CS & SE site's colors, fonts, spacing, header, footer, and navy bands, so the two read as one department. A few decorative patterns from that site are left out to keep this one plain and fast to scan:

- No small uppercase labels above headings, and headlines are one color.
- Buttons and tags have small square corners instead of pill shapes.
- Flat navy bands, with no glow or grid pattern.
- Cards have a thin border and no shadow, and nothing jumps or slides on hover.
- No icon tiles, number badges, or rows of big statistics.

The reel covers carry the page; text stays short and plain.

## Content

- 36 reels from [@byui.cse](https://www.instagram.com/byui.cse/). Two t-shirt day posts, the STC bug hunt, and one reel with no caption are left out.
- Titles come from each reel's caption or the words on screen. Career Quest keeps its part numbers.
- Tags are a first pass for review.
- None of the reels are on YouTube yet. The department channel is BYU-I CSE ([@byui-cse](https://www.youtube.com/@byui-cse)), where CSE Tech Talks is a series. Once reels are uploaded there, add each `youtube` link and the site plays YouTube first.

## Open questions for Brother Crosby

1. Which stats should each video show ("# new people, # of projects")? The field is ready; it stays hidden until a video has stats.
2. Should the YouTube channel's other videos (Tech Talks episodes, interviews) go in the library too, or only the reels once they are uploaded?
3. Should department announcements, like t-shirt day, be in the library?
4. Are the titles and tags right?
5. Who can turn on GitHub Pages for the repo, and should the site move to a department domain later?
