/**
 * One video's page: one navy band holds the whole record. The title, its
 * facts and Copy link come first, then the player, then the caption, the
 * series steps and the docket; on wider screens the player takes a column
 * of its own beside them. Under the band, the rest of its series in part
 * order and videos that share its rarest topics.
 */
import { html, linkify, plainText, raw, smartQuotes } from "../html.js";
import { relatedVideos, seriesNeighbors, seriesParts } from "../related.js";
import { breadcrumbs, videoObject } from "../seo.js";
import {
    cover,
    embedUrls,
    formatDate,
    paragraphs,
    partTitle,
    sameText,
    spokenLength,
    statName,
    summary,
    tagName,
    youtubeShape
} from "../site.js";
import { addressParts } from "../../src/js/share.js";
import { SOURCE_NAMES, layout } from "./layout.js";
import { SIZES, copyLink, dateTime, lengthTime, picture, tile } from "./parts.js";

// Instagram's player posts its first messages as soon as it loads, which on a
// fast connection is before js/main.js runs. This keeps them for the player
// (src/js/player.js), which replays them when it starts.
const INSTAGRAM_QUEUE = 'addEventListener("message", (event) => { if (event.origin === "https://www.instagram.com") { (window.instagramMessages ||= []).push({ data: event.data, source: event.source }); } });';

const RELATED_COUNT = 6;

// The poster under the player: the screen's full width on a phone, where the
// player runs edge to edge, then the player column (src/css/components/player.css).
const POSTER_SIZES = "(max-width: 699px) 100vw, (max-width: 1099px) 328px, 400px";

// The link to send breaks where the browser's copy does (src/js/share.js).
export { addressParts };

/**
 * The player: the switch or "Only on" line and Expand, then the embed over
 * the cover, which shows until the embed paints. From 700 px the line and
 * Expand sit under the head's buttons, beside the embed. Expand stays hidden
 * on a phone held upright, where the player already shows whole at the
 * screen's width.
 * @param {import("./layout.js").Site} site
 * @param {import("./layout.js").Video} video
 * @param {string} root
 */
const player = (site, video, root) => {
    const urls = embedUrls(video);
    const sources = /** @type {("youtube" | "instagram")[]} */ (Object.keys(urls));
    const first = sources[0];
    const shape = video.youtube ? youtubeShape(video.youtube) : "tall";
    const title = smartQuotes(video.title);

    return html`<div class="player" data-player data-source="${first}" data-youtube-shape="${shape}" data-title="${title}"${sources.map((source) => html` data-${source}-src="${urls[source]}"`)}>
	<div class="player__bar">
		${sources.length > 1
        ? html`<div class="player__sources" role="group" aria-labelledby="watch-on" data-needs-js hidden>
			<span class="player__sources-label" id="watch-on">Watch on</span>
			${sources.map((source, index) => html`${index > 0 && raw('<span class="player__divider" aria-hidden="true">|</span>')}<button class="player__source" type="button" data-source-button="${source}" aria-pressed="${String(source === first)}">${SOURCE_NAMES[source]}</button>`)}
		</div>`
        : html`<p class="player__only" data-only-on>Only on ${SOURCE_NAMES[first]}</p>`}
		<button class="player__expand" type="button" data-expand data-needs-js hidden>Expand</button>
	</div>
	<div class="player__frame">
		${picture(site, video, root, { sizes: POSTER_SIZES, loading: "eager", priority: true, className: "player__poster" })}
		<iframe class="player__iframe" src="${urls[first]}" title="${title} (${SOURCE_NAMES[first]})" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
	</div>
</div>`;
};

/**
 * A title with each hyphenated word held together, so a compound like
 * "real-world" never splits across the heading's lines.
 * @param {string} title
 */
const wholeWords = (title) => title.split(/(\S+-\S+)/).map((part, index) => (index % 2 ? html`<span>${part}</span>` : part));

/**
 * The caption as it was posted, unless it only repeats the title or the
 * series and part.
 * @param {import("./layout.js").Video} video
 */
const usableCaption = (video) => {
    const caption = video.description?.trim() ?? "";
    const seriesLabel = video.series && video.part ? `${video.series} Part ${video.part}` : "";

    return caption !== "" && !sameText(caption, video.title)
        && !(seriesLabel && sameText(caption, seriesLabel))
        && !/^[\p{L}\p{N} &'’–—-]+\s*[-–—,:]\s*Part\s+\d+\s*:?[\s]*$/iu.test(caption);
};

/**
 * @param {import("./layout.js").Site} site
 * @param {import("./layout.js").Video} video
 * @returns {string}
 */
export const videoPage = (site, video) => {
    const root = "../../";
    const image = cover(video, site.covers.get(video.id), root);
    const hasCaption = usableCaption(video);
    const length = video.length
        ? spokenLength(video.length).replace(/(hours|minutes|seconds)/g, (unit) => unit.slice(0, -1)).replaceAll(" ", "-")
        : "";
    const fallback = `A${length ? ` ${length}` : ""} video from BYU-Idaho Computer Science and Engineering, posted ${formatDate(video.datePosted)}.`;
    const description = hasCaption ? summary(plainText(video.description.trim())) : fallback;
    const stats = Object.entries(video.stats ?? {});
    const parts = seriesParts(video, site.videos);
    const seriesName = video.series ? tagName(video.series, site.names) : "";
    const { previous, next } = seriesNeighbors(video, site.videos);
    const related = relatedVideos(video, site.videos, { limit: RELATED_COUNT });
    // The heading names the topics the related videos actually share.
    const relatedTopics = video.tags
        .filter((slug) => related.some((item) => item.tags.includes(slug)))
        .slice(0, 2)
        .map((slug) => tagName(slug, site.names));
    const pageUrl = site.siteUrl ? `${site.siteUrl}videos/${video.id}/` : `videos/${video.id}/`;
    const seriesLink = video.series && html`<a href="${root}tags/${video.series}/">${seriesName}</a>, part ${video.part} of ${parts.length}`;
    const step = (item, label, rel) => item && html`<a class="steps__link" href="${root}videos/${item.id}/" rel="${rel}">${label}: Part ${item.part}<span class="visually-hidden">, ${smartQuotes(partTitle(item.title, seriesName))}</span></a>`;

    const body = html`<section class="player-band" aria-labelledby="page-title">
	<div class="container player-band__inner">
		<p class="player-band__back"><a href="${root}" data-back>All videos</a></p>
		<div class="player-band__head">
			${seriesLink && html`<p class="player-band__series">${seriesLink}</p>`}
			<h1 class="player-band__title" id="page-title">${wholeWords(smartQuotes(video.series ? partTitle(video.title, seriesName) : video.title))}</h1>
			<p class="player-band__facts"><span>Posted ${dateTime(video.datePosted)}</span>${video.length && html` <span><span aria-hidden="true">· </span>${lengthTime(video.length)}</span>`}</p>
			<div class="player-band__actions">
				${copyLink("Copy link")}
				${video.youtube && html`<a class="button player-band__open" href="${video.youtube}">Open on YouTube</a>`}
				${video.instagram && html`<a class="button player-band__open" href="${video.instagram}">Open on Instagram</a>`}
			</div>
		</div>
		${player(site, video, root)}
		<div class="record">
			<h2 class="visually-hidden" id="record-title">About this video</h2>
			${hasCaption && html`<div class="record__caption prose">
				${paragraphs(video.description).map((lines) => html`<p>${lines.map((line, index) => html`${index > 0 && raw("<br>")}${linkify(smartQuotes(line))}`)}</p>`)}
			</div>`}
			${(previous || next) && html`<nav class="steps" aria-label="${seriesName} parts">
				${step(previous, "Previous", "prev")}
				${step(next, "Next", "next")}
			</nav>`}
			<dl class="docket">
				<dt>Topics</dt><dd>${video.tags.map((slug, index) => html`${index > 0 && ", "}<a href="${root}tags/${slug}/">${tagName(slug, site.names)}</a>`)}</dd>
				${video.dateCreated && html`<dt>Made</dt><dd>${dateTime(video.dateCreated)}</dd>`}
				${video.attributions?.length > 0 && html`<dt>Credits</dt><dd><ul class="plain-list">${video.attributions.map((credit) => html`<li>${linkify(smartQuotes(credit))}</li>`)}</ul></dd>`}
				${stats.map(([key, count]) => html`<dt>${statName(key)}</dt><dd>${count}</dd>`)}
				<dt>Link to send</dt><dd><span class="docket__link" data-page-url>${addressParts(pageUrl).map((part) => html`<span>${part}</span>`)}</span></dd>
			</dl>
		</div>
	</div>
</section>
${parts.length > 0 && html`
<section class="more more--series" aria-labelledby="series-title">
	<div class="container">
		<h2 class="section-title section-title--small" id="series-title">${seriesName}, in part order</h2>
		<ol class="grid grid--parts">
			${parts.map((item, index) => tile(site, item, root, index, { current: item.id === video.id, sizes: SIZES.part }))}
		</ol>
	</div>
</section>`}
${related.length > 0 && html`
<section class="more" aria-labelledby="related-title">
	<div class="container">
		<h2 class="section-title section-title--small" id="related-title">More on ${relatedTopics.join(" and ")}</h2>
		<ol class="grid">
			${related.map((item, index) => tile(site, item, root, index))}
		</ol>
	</div>
</section>`}`;

    return layout({
        site,
        root,
        path: `videos/${video.id}/`,
        title: video.title,
        description,
        body,
        section: "videos",
        image,
        type: "video.other",
        inlineScript: video.instagram ? INSTAGRAM_QUEUE : null,
        structuredData: site.siteUrl ? [
            videoObject({
                video,
                thumbnailUrl: image ? new URL(image.src, `${site.siteUrl}videos/${video.id}/`).href : null,
                url: `${site.siteUrl}videos/${video.id}/`
            }),
            breadcrumbs([
                { name: "Videos", url: site.siteUrl },
                { name: video.title, url: `${site.siteUrl}videos/${video.id}/` }
            ])
        ] : []
    });
};
