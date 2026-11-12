/**
 * The Video wall: a page that is only the wall, every reel's still in small
 * columns at least a screen tall, with the search in a navy strip docked to
 * the foot of the screen while the wall scrolls. A search lights the stills
 * that match and dims the rest.
 */
import { html } from "../html.js";
import { libraryLine, newestFirst, searchWords } from "../site.js";
import { WALL_LEAD, wallFill, wallOrder, wallTotal } from "../wall.js";
import { SEARCH_ICON, layout } from "./layout.js";
import { SIZES, wallStill } from "./parts.js";

// The first four rows of fourteen load at once, the rest when they come near.
const EAGER_STILLS = 56;

/**
 * The strip comes first, so the search is the first stop for the keyboard;
 * the stylesheet docks it under the wall. Each video's own still is a link
 * named by its title; the echoes that fill the rest of the stage, including
 * the top row, which is lifted past the stage's edge, are hidden from screen
 * readers and the keyboard.
 * @param {import("./layout.js").Site} site
 * @returns {string}
 */
export const videoWallPage = (site) => {
    const root = "../";
    const videos = newestFirst(site.videos);
    const stills = wallFill(wallOrder(videos), wallTotal(videos.length), WALL_LEAD);

    const body = html`<section class="wall-stage" aria-labelledby="page-title">
	<div class="band">
		<div class="container band__inner">
			<div class="band__lead">
				<h1 class="band__title" id="page-title">Video wall</h1>
				<p class="band__pointing" aria-hidden="true" data-wall-caption></p>
			</div>
			<div class="band__find">
				<form class="search" role="search" action="./" method="get" data-search-form data-needs-js hidden>
					<label class="visually-hidden" for="search">Search videos</label>
					<div class="search__field">${SEARCH_ICON}<input class="search__input" id="search" name="q" type="search" autocomplete="off" enterkeyhint="search" spellcheck="false" placeholder="Try portfolio, interviews or internships" data-placeholder-short="Try portfolio or interviews" data-search-input></div>
				</form>
				<p class="band__count" data-results>${libraryLine(videos)}</p>
			</div>
		</div>
	</div>
	<p class="visually-hidden" data-announce role="status"></p>
	<div class="wall-stage__area">
		<ul class="wall wall--page" aria-label="Every video" data-wall data-wall-page>
			${stills.map(({ video, echo }, slot) => wallStill(site, video, root, {
                sizes: SIZES.wall,
                loading: slot < EAGER_STILLS ? "eager" : "lazy",
                focusable: true,
                echo,
                words: echo ? "" : searchWords(video, site.names)
            }))}
		</ul>
	</div>
</section>`;

    return layout({
        site,
        root,
        path: "wall/",
        title: "Video wall",
        description: "Every video from the BYU-Idaho Department of Computer Science and Engineering on one wall. Search it to light up the ones a student needs.",
        body,
        current: "wall"
    });
};
