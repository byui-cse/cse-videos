/**
 * The topics: every topic as a photo card, and a page per topic with a short
 * navy head (its name, count, running time and Copy link) over its videos.
 */
import { html, raw } from "../html.js";
import { seriesParts } from "../related.js";
import { breadcrumbs } from "../seo.js";
import { cover, listFacts, newestFirst, plural, popularTags } from "../site.js";
import { topicStills } from "../wall.js";
import { layout } from "./layout.js";
import { SIZES, copyLink, sortControl, tile, topicCard } from "./parts.js";

// The first four cards load at once: the grid's top row at full width, and
// all of it a phone or a tablet shows before scrolling. The first card's
// stills, the page's largest picture, are asked for first of all.
export const EAGER_TOPICS = 4;

// A topic with this many videos or fewer draws each one at the size of the
// home page's newest, so its row isn't mostly empty.
export const FEW_VIDEOS = 2;

/**
 * @param {import("./layout.js").Site} site
 * @returns {string}
 */
export const tagsPage = (site) => {
    const root = "../";
    const topics = popularTags(site.tags, site.tags.length);
    const wide = new Set(topics.slice(0, 2).map((tag) => tag.slug));
    const stills = topicStills(topics, newestFirst(site.videos), wide);

    const body = html`<section class="page-band" aria-labelledby="page-title">
	<div class="container page-band__inner">
		<h1 class="page-band__title" id="page-title">Topics</h1>
		<p class="page-band__meta">${plural(topics.length, "topic")} across ${plural(site.videos.length, "video")}, the most used first. A&nbsp;video can have more than one.</p>
	</div>
</section>

<section class="topics" aria-label="Every topic">
	<div class="container">
		<ul class="topic-grid">
			${topics.map((tag, index) => topicCard(site, tag, stills.get(tag.slug), `${tag.slug}/`, root, {
                wide: wide.has(tag.slug),
                heading: "h2",
                loading: index < EAGER_TOPICS ? "eager" : "lazy",
                priority: index === 0
            }))}
		</ul>
	</div>
</section>`;

    return layout({
        site,
        root,
        path: "tags/",
        title: "Topics",
        description: `Every topic on CSE Videos, the BYU-Idaho Computer Science and Engineering video library: ${topics.map((tag) => tag.name).join(", ")}.`,
        body,
        current: "tags"
    });
};

/**
 * The list's heading. The head already names the topic and its count, and
 * the menu its order, so the heading is for screen readers; on a topic with
 * an order to choose it follows the menu ("Newest first", "Oldest first").
 * @param {boolean} sortable
 * @param {string} text
 */
const listHeading = (sortable, text) => sortable
    ? html`<div class="section-head">
				<div class="visually-hidden"><h2 class="section-title section-title--small" id="listing-heading" tabindex="-1" data-heading-newest="Newest first" data-heading-oldest="Oldest first">${text}</h2></div>
				<div class="section-head__tools" data-needs-js hidden>
					${sortControl("newest")}
				</div>
			</div>`
    : html`<h2 class="visually-hidden" id="listing-heading" tabindex="-1">${text}</h2>`;

/**
 * @param {import("./layout.js").Site} site
 * @param {import("./layout.js").Tag} tag
 * @returns {string}
 */
export const tagPage = (site, tag) => {
    const root = "../../";
    const videos = newestFirst(site.videos.filter((video) => video.tags.includes(tag.slug)));
    const newest = videos[0];
    // A series tag, like Career Quest, is always in part order, and a single
    // video has no order to choose.
    const series = videos.length > 0 && videos.every((video) => video.series === tag.slug);
    const sortable = !series && videos.length > 1;
    const first = series ? seriesParts({ series: tag.slug }, videos)[0] : null;
    const lead = !series && videos.length <= FEW_VIDEOS;
    const cards = videos.map((video, index) => tile(site, video, root, index, series ? { sizes: SIZES.part } : { lead }));
    const facts = listFacts(videos, series ? "part" : "video");

    const body = html`<section class="tag-hero" aria-labelledby="page-title">
	<div class="container tag-hero__inner">
		<div>
			<p class="tag-hero__crumb"><a href="../">Topics</a></p>
			<h1 class="tag-hero__title" id="page-title">${tag.name}</h1>
		</div>
		<div class="tag-hero__facts">
			<p class="tag-hero__count" data-results>${facts.long}</p>
			<p class="tag-hero__actions">${first && html`<a class="button button--light" href="${root}videos/${first.id}/">Start with Part ${first.part}</a> `}${copyLink("Copy link")}</p>
		</div>
	</div>
</section>

<section class="index index--tag${series ? " index--series" : ""}" aria-labelledby="listing-heading">
	<div class="container">
		${listHeading(sortable, series ? "In part order" : sortable ? "Newest first" : plural(videos.length, "video"))}
		<p class="visually-hidden" data-announce role="status"></p>
		<ol class="grid" data-video-list${series && raw(' data-default-order="oldest"')}>
			${series ? cards.reverse() : cards}
		</ol>
	</div>
</section>`;

    return layout({
        site,
        root,
        path: `tags/${tag.slug}/`,
        title: `${tag.name} videos`,
        description: `${plural(videos.length, "video")} on ${tag.name} from the BYU-Idaho Computer Science and Engineering department.`,
        body,
        section: "tags",
        image: newest ? cover(newest, site.covers.get(newest.id), root) : null,
        structuredData: site.siteUrl ? [breadcrumbs([
            { name: "Topics", url: `${site.siteUrl}tags/` },
            { name: tag.name, url: `${site.siteUrl}tags/${tag.slug}/` }
        ])] : []
    });
};
