/**
 * The home page: a navy hero with the headline, a line on what the search
 * covers and the search beside a card holding the wall of every reel, shrunk,
 * with the way to the Video wall under the card; then the index of all
 * videos, the topics, and the featured series.
 */
import { html, raw, smartQuotes } from "../html.js";
import { seriesParts } from "../related.js";
import { websiteSchema } from "../seo.js";
import { clock, libraryLine, newestFirst, oneADay, partTitle, plural, popularTags, runningTime, spokenLength } from "../site.js";
import { CARD_FRONT, CARD_STILLS, cardOrder, topicStills, wallFill } from "../wall.js";
import { SEARCH_ICON, SITE_NAME, featuredSeries, layout } from "./layout.js";
import { SIZES, copyButton, copyLink, dateTime, lengthTime, picture, sortControl, tile, topicRow, wallStill } from "./parts.js";

// The card shows at most three rows of five (one row on a phone or a tablet
// held upright); those load at once, the rest when a search brings them
// forward. None is preloaded or hurried: they are small, never the largest
// thing on the first screen, and would hold back the stylesheet and fonts.
const EAGER_STILLS = CARD_FRONT;

// On a phone the index opens on this many videos, with a button for the
// rest: the lead tile's two rows and six full rows of two.
const PHONE_FOLD = 13;

// What a series is, in a few words, where one has been written. A series
// without one is introduced by its count alone.
const SERIES_INTROS = {
    "career-quest": "A job search told as a game"
};

const NUMBER_WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

const ARROW = raw('<svg class="arrow-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>');

/**
 * "five" for 5, "12" for 12.
 * @param {number} count
 */
const countWord = (count) => NUMBER_WORDS[count] ?? String(count);

/**
 * The wall, shrunk into the hero's card: every video once, the covers off
 * the quiet list first, then echoes to fill the card. It is a picture of the
 * library, for the pointer. Every video on it is also in the index below, so
 * it stays out of the tab order and away from screen readers.
 * @param {import("./layout.js").Site} site
 * @param {import("./layout.js").Video[]} videos newest first
 * @param {string} root
 */
const wall = (site, videos, root) => html`<ul class="wall wall--card" aria-hidden="true" data-wall>
				${wallFill(cardOrder(videos), CARD_STILLS).map(({ video, echo }, slot) => wallStill(site, video, root, { sizes: SIZES.card, loading: slot < EAGER_STILLS ? "eager" : "lazy", echo }))}
			</ul>`;

/**
 * The featured series as one row of boards, in part order.
 * @param {import("./layout.js").Site} site
 * @param {{ slug: string, name: string }} series
 * @param {string} root
 */
const seriesSection = (site, series, root) => {
    const parts = seriesParts({ series: series.slug }, site.videos);
    const first = parts[0];
    const last = parts.at(-1);
    const total = runningTime(parts);
    const intro = SERIES_INTROS[series.slug];
    const count = intro ? `${intro}, in ${countWord(parts.length)} part${parts.length === 1 ? "" : "s"}` : plural(parts.length, "part");
    const span = parts.length > 1
        ? html`posted ${oneADay(parts) ? "one a day " : ""}from ${dateTime(first.datePosted, "full")} to ${dateTime(last.datePosted, "full")}`
        : html`posted ${dateTime(first.datePosted, "full")}`;

    return html`<section class="quest" id="${series.slug}" aria-labelledby="quest-title">
	<div class="container">
		<div class="quest__head">
			<h2 class="section-title" id="quest-title">${series.name}</h2>
			<p class="quest__lede">${count}, ${span}.${total !== null && ` Watch them in order: ${spokenLength(clock(total))} in all.`}</p>
			<p class="quest__actions"><a class="button button--light" href="${root}videos/${first.id}/">Start with Part ${first.part}</a> ${copyButton(`${root}tags/${series.slug}/`, series.name, "button button--light", "Copy series link")}</p>
		</div>
		<ol class="quest__boards" data-quest-boards>
			${parts.map((video) => html`<li class="board">
				<a class="board__link" href="${root}videos/${video.id}/" data-reel-link>
					<span class="board__image" data-reel>${picture(site, video, root, { sizes: SIZES.board })}</span>
					<span class="board__part">Part ${video.part}</span>
					<span class="board__title">${smartQuotes(partTitle(video.title, series.name))}</span>
					<span class="board__meta">${dateTime(video.datePosted, "weekday")}${video.length && html`<span aria-hidden="true"> · </span>${lengthTime(video.length)}`}</span>
				</a>
				${copyButton(`${root}videos/${video.id}/`, `${series.name}, Part ${video.part}`, "board__copy")}
			</li>`)}
		</ol>
		<p class="quest__end"><a href="${root}tags/${series.slug}/">${series.name} on its own page</a></p>
	</div>
</section>`;
};

/**
 * @param {import("./layout.js").Site} site
 * @returns {string}
 */
export const homePage = (site) => {
    // "./" rather than "": an empty link would keep a search in the address,
    // so the site name and All videos link wouldn't clear it.
    const root = "./";
    const videos = newestFirst(site.videos);
    const topics = popularTags(site.tags, site.tags.length);
    // One small still per topic, a different one wherever a topic has one free.
    const stills = topicStills(topics, videos, new Set());
    const series = featuredSeries(site);

    const body = html`<section class="hero" aria-labelledby="page-title">
	<div class="container hero__inner">
		<div class="hero__copy">
			<h1 class="hero__title" id="page-title"><span class="hero__line">Find the right video</span> <span class="hero__line hero__line--accent">for a student</span></h1>
			<p class="hero__lede" data-needs-js hidden>Search by topic, title or caption, then copy a link to send.</p>
			<form class="search hero__search" role="search" action="./" method="get" data-search-form data-needs-js hidden>
				<label class="visually-hidden" for="search">Search videos</label>
				<div class="search__field">${SEARCH_ICON}<input class="search__input" id="search" name="q" type="search" autocomplete="off" enterkeyhint="search" spellcheck="false" placeholder="Try portfolio, interviews or internships" data-placeholder-short="Try portfolio or interviews" data-search-input></div>
			</form>
			<ul class="hero__facts">
				<li data-results>${libraryLine(videos)}</li>
				${topics.length > 0 && html`<li><a href="${root}tags/">${plural(topics.length, "topic")}</a></li>`}
			</ul>
		</div>
		<div class="hero__media">
			<div class="hero__card">
				${wall(site, videos, root)}
			</div>
			<div class="hero__under">
				<p class="hero__pointing" aria-hidden="true" data-wall-caption></p>
				<a class="hero__open" href="${root}wall/">Open the video wall ${ARROW}</a>
			</div>
		</div>
	</div>
</section>

<section class="index" id="all-videos" aria-labelledby="listing-heading">
	<div class="container">
		<div class="section-head">
			<div class="section-head__intro">
				<h2 class="section-title" id="listing-heading" tabindex="-1">All videos</h2>
				<p class="section-head__lede">Every video has its own page and a link to send to a student.</p>
			</div>
			<div class="section-head__tools" data-needs-js hidden>
				${sortControl("newest")}
				${copyLink("Copy link to this list")}
			</div>
		</div>
		<p class="visually-hidden" data-announce role="status"></p>
		<ol class="grid" data-video-list data-tile-sizes="${SIZES.tile}" data-lead-sizes="${SIZES.lead}" data-phone-fold="${PHONE_FOLD}">
			${videos.map((video, index) => tile(site, video, root, index, { lead: index === 0 }))}
		</ol>
		${videos.length > PHONE_FOLD && html`<p class="index__more" data-show-all-row hidden><button class="button button--light" type="button" data-show-all>Show all ${plural(videos.length, "video")}</button></p>`}
		<div class="empty" data-empty hidden>
			<p class="empty__line">No videos match that search.</p>
			<p>Try one word, like <a href="./?q=resume">resume</a> or <a href="./?q=interview">interview</a>, or pick a topic below.</p>
			<p><button class="button" type="button" data-clear-search>Clear the search</button></p>
		</div>
	</div>
</section>

<section class="topics" id="topics" aria-labelledby="topics-title">
	<div class="container">
		<div class="section-head">
			<div class="section-head__intro">
				<h2 class="section-title" id="topics-title">Topics</h2>
				<p class="section-head__lede">All ${plural(topics.length, "topic")}, the most used first.</p>
			</div>
		</div>
		<ul class="topic-list">
			${topics.map((tag) => topicRow(site, tag, stills.get(tag.slug)[0], `${root}tags/${tag.slug}/`, root))}
		</ul>
	</div>
</section>

${series && seriesSection(site, series, root)}`;

    return layout({
        site,
        root,
        path: "",
        title: SITE_NAME,
        description: "Videos from the BYU-Idaho Department of Computer Science and Engineering. Search them, browse them by topic, and share a link to any one.",
        body,
        current: "videos",
        home: true,
        structuredData: site.siteUrl ? [websiteSchema(site.siteUrl)] : []
    });
};
