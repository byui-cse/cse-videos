# CSE Videos: project plan

A website where students and faculty find, watch, and share the department's videos. Brother Crosby's requirements are in issue #3.

- **Stakeholder:** Brother Crosby
- **Builder:** Levi Mackay

## Requirements (issue #3)

| # | Requirement | Status |
| --- | --- | --- |
| 1 | Search for a video by text or tag | Done. The home page search matches titles, descriptions, tags, and credits as you type, and lights the matching stills on the wall. |
| 2 | Show the tag directory | Done. `/tags/` shows every tag as a topic card with its count and running time. |
| 3 | Show the videos with a given tag | Done. `/tags/<tag>/` |
| 4 | Watch the embedded video, expandable | Done. Each video has its own page; Expand fills the window without restarting the video. |
| 5 | Share a tag, search, or video by URL | Done. Search, sort, tag, video, and player choice all live in the address, and there is a Copy link button. |
| 6 | Videos and metadata in a JSON file in git | Done. `data/videos.json`, plus `data/tags.json` for tag names. |
| 7 | Update the site on push with GitHub Actions | Done. Waiting on a repo admin to turn on Pages (Settings > Pages > Source: GitHub Actions). |
| 8 | Play from YouTube or Instagram | Done. Videos with both links can switch between them; Instagram's player shows likes and comments. |
| 9 | Show videos in date order | Done. Newest first, with an Oldest first option. |
| Design | Use the CSS from the CS & SE site; works on computers and phones | Changed. The site keeps the CS & SE colors and follows byui.edu's structure instead of the CS & SE layout (see Design). Works on computers and phones. |

## Design

The site follows the official BYU-Idaho web presence: a blue utility bar naming the department over a white header, navy bands, and a blue footer over a dark legal band. Only the colors come from the CS & SE site; its layout, components, and fonts are not used.

- The home page opens on a wall of every video's still, with one line and the search on a slim navy strip across its foot. Below it are all the videos, newest first, then the topics as photo cards, then Career Quest in part order.
- Each video page puts the player on a navy band with the title beside it, then the caption and the facts, the rest of its series, and related videos.
- Type is Sofia Sans and Sofia Sans Semi Condensed. Stills have square corners; buttons and fields have small 4 px corners. No pills, uppercase labels, gradients, or shadows.
- Motion is light: one fade when the home page loads, a slow drift on the wall, Career Quest fading up once, and effects that answer a pointer or a click. None of it plays with reduced motion turned on.

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
6. The new look keeps the CS & SE colors but not the rest of that site's CSS. Is that all right in place of "Use the CSS from the CS & SE site"?
7. Is there a department mark for the browser tab? Until there is, the icon is the letters CSE in white on navy.
