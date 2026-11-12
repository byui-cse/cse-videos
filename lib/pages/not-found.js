/**
 * The page for addresses that go nowhere: what happened, a search that goes
 * to the home page's results, a way to every video, and the most used
 * topics, so a mistyped link still lands somewhere useful.
 */
import { html } from "../html.js";
import { newestFirst, plural, popularTags } from "../site.js";
import { topicStills } from "../wall.js";
import { SEARCH_ICON, layout } from "./layout.js";
import { topicRow } from "./parts.js";

// Two rows of the home page's topic directory at its widest.
export const MISSING_TOPICS = 8;

/**
 * GitHub Pages serves this for any missing address, at any depth, so its
 * links start from the site's root path instead of being relative. (A <base>
 * would also send the skip link's #main to the home page.)
 * @param {import("./layout.js").Site} site
 * @returns {string}
 */
export const notFoundPage = (site) => {
    const root = site.siteUrl ? new URL(site.siteUrl).pathname : "/";
    const topics = popularTags(site.tags, site.tags.length);
    const shown = topics.slice(0, MISSING_TOPICS);
    const stills = topicStills(shown, newestFirst(site.videos), new Set());

    return layout({
        site,
        root,
        path: "404.html",
        noindex: true,
        title: "Page not found",
        description: "This address doesn’t go to a video or a topic.",
        body: html`<section class="missing" aria-labelledby="page-title">
	<div class="container missing__inner">
		<div>
			<h1 class="missing__title" id="page-title">Page not found</h1>
			<p class="missing__lede">This address doesn’t go to a video or a topic. Search the videos, or start from a topic.</p>
		</div>
		<div class="missing__find">
			<form class="search" role="search" action="${root}" method="get" data-needs-js hidden>
				<label class="visually-hidden" for="missing-search">Search videos</label>
				<div class="search__field">${SEARCH_ICON}<input class="search__input" id="missing-search" name="q" type="search" autocomplete="off" enterkeyhint="search" spellcheck="false" placeholder="Try portfolio or interviews"></div>
			</form>
			<p><a class="button button--light" href="${root}">See all videos</a></p>
		</div>
	</div>
</section>
${shown.length > 0 && html`
<section class="topics" aria-labelledby="topics-title">
	<div class="container">
		<div class="section-head">
			<div class="section-head__intro">
				<h2 class="section-title" id="topics-title">Topics</h2>
				<p class="section-head__lede">${shown.length < topics.length
                    ? html`The ${shown.length} most used of ${plural(topics.length, "topic")}. <a href="${root}tags/">See them all</a>`
                    : html`All ${plural(topics.length, "topic")}, the most used first.`}</p>
			</div>
		</div>
		<ul class="topic-list">
			${shown.map((tag) => topicRow(site, tag, stills.get(tag.slug)[0], `${root}tags/${tag.slug}/`, root))}
		</ul>
	</div>
</section>`}`
    });
};
