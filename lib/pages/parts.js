/**
 * Pieces several pages use: pictures of the covers, dates and lengths, the
 * link buttons, a video's tile in a grid, and a topic's card.
 */
import { html, raw, smartQuotes } from "../html.js";
import { coverSources } from "../images.js";
import { cover, formatDate, isoDuration, listFacts, searchWords, spokenLength } from "../site.js";

// What each placement draws a still at, for the browser to pick a copy.
export const SIZES = {
    wall: "(max-width: 699px) 34vw, (max-width: 1099px) 25vw, 17vw",
    tile: "(max-width: 699px) 46vw, (max-width: 1099px) 23vw, 204px",
    lead: "(max-width: 699px) 92vw, (max-width: 1099px) 46vw, 432px",
    topic: "(max-width: 699px) 46vw, (max-width: 1099px) 31vw, 204px",
    row: "(max-width: 699px) 56px, 96px",
    board: "(max-width: 428px) 84vw, (max-width: 899px) 360px, 268px",
    player: "(max-width: 699px) 92vw, 400px"
};

/**
 * A video's cover: its own file as AVIF, WebP and JPEG at the sizes this
 * placement needs; otherwise YouTube's thumbnail; otherwise a labelled box.
 * Always in a <picture>, so every still is drawn the same way.
 * @param {import("./layout.js").Site} site
 * @param {import("./layout.js").Video} video
 * @param {string} root
 * @param {{ sizes: string, loading?: "lazy" | "eager", priority?: boolean, className?: string }} options
 */
export const picture = (site, video, root, { sizes, loading = "lazy", priority = false, className = "" }) => {
    const size = site.covers.get(video.id);
    const image = cover(video, size, root);

    if (!image) {
        return html`<span class="no-cover">No cover image</span>`;
    }

    const img = html`<img${className && html` class="${className}"`} src="${image.src}" alt="" width="${image.width}" height="${image.height}" loading="${loading}" decoding="async"${priority && raw(' fetchpriority="high"')}>`;

    // YouTube's thumbnail comes in one size only.
    const sources = size ? coverSources(video.id, size, root) : [];

    return html`<picture>${sources.map((source) => html`<source type="${source.type}" srcset="${source.srcset}" sizes="${sizes}">`)}${img}</picture>`;
};

/**
 * A <time> for a date.
 * @param {string} isoDate
 * @param {"full" | "weekday" | "long" | "medium"} [style]
 */
export const dateTime = (isoDate, style = "long") => html`<time datetime="${isoDate}">${formatDate(isoDate, style)}</time>`;

/**
 * A <time> for a length, read out in words ("1 minute 5 seconds").
 * @param {string} length
 */
export const lengthTime = (length) =>
    html`<time datetime="${isoDuration(length)}"><span aria-hidden="true">${length}</span><span class="visually-hidden">${spokenLength(length)}</span></time>`;

/**
 * The link button for the page as it is now, with its search, order or
 * player. The label confirms the copy in place, so nothing around it moves;
 * the hidden status says it to screen readers. Needs JavaScript, so it
 * starts hidden. One per page.
 * @param {string} label
 * @param {string} [className]
 */
export const copyLink = (label, className = "button button--light") => html`<span class="copy-link" data-needs-js hidden>
	<button class="${className} copy-link__button" type="button" data-copy-link>${label}</button>
	<span class="visually-hidden" data-copy-status role="status"></span>
</span>`;

/**
 * A link button for another page, like one video or a series. Says which in
 * its name for screen readers.
 * @param {string} href relative to this page
 * @param {string} name what the link goes to
 * @param {string} className
 * @param {string} [label]
 */
export const copyButton = (href, name, className, label = "Copy link") =>
    html`<button class="${className}" type="button" data-copy="${href}" data-copy-name="${name}" data-needs-js hidden>${label}<span class="visually-hidden" data-copy-suffix> to ${name}</span></button>`;

/**
 * One video in a grid. The link holds the still and the title; the date line
 * and Copy link sit under it. The link is named by title, date and spoken
 * length; the visible date line repeats that for sighted readers.
 * @param {import("./layout.js").Site} site
 * @param {import("./layout.js").Video} video
 * @param {string} root
 * @param {number} order position in the newest-first list
 * @param {{ lead?: boolean, current?: boolean }} [options]
 */
export const tile = (site, video, root, order, { lead = false, current = false } = {}) => {
    const title = smartQuotes(video.title);
    const href = `${root}videos/${video.id}/`;

    return html`<li class="tile${lead ? " tile--lead" : ""}${current ? " tile--current" : ""}" data-id="${video.id}" data-search="${searchWords(video, site.names)}" data-order="${order}">
	<a class="tile__link" href="${href}"${current && raw(' aria-current="page"')} data-reel-link>
		<span class="tile__image" data-reel>${picture(site, video, root, { sizes: lead ? SIZES.lead : SIZES.tile })}</span>
		<span class="tile__title">${title}</span><span class="visually-hidden">, posted ${formatDate(video.datePosted)}${video.length && `, ${spokenLength(video.length)}`}</span>
		${current && html`<span class="tile__now">Playing on this page</span>`}
	</a>
	<div class="tile__line">
		<span class="tile__meta" aria-hidden="true">${dateTime(video.datePosted, "medium")}${video.length && html` · <time datetime="${isoDuration(video.length)}">${video.length}</time>`}</span>
		${copyButton(href, title, "tile__copy")}
	</div>
</li>`;
};

/**
 * A topic's card: its stills, its name as the link, its count and running
 * time. The link covers the whole card.
 * @param {import("./layout.js").Site} site
 * @param {import("./layout.js").Tag} tag
 * @param {import("./layout.js").Video[]} stills
 * @param {string} href
 * @param {string} root
 * @param {{ wide?: boolean, heading?: "h2" | "h3" }} [options]
 */
export const topicCard = (site, tag, stills, href, root, { wide = false, heading = "h3" } = {}) => {
    const facts = listFacts(site.videos.filter((video) => video.tags.includes(tag.slug)));
    const name = html`<a class="topic__link" href="${href}">${tag.name}</a>`;

    return html`<li class="topic${wide ? " topic--wide" : ""}">
	<span class="topic__images">${stills.map((video) => html`<span class="topic__image">${picture(site, video, root, { sizes: SIZES.topic })}</span>`)}</span>
	${heading === "h2" ? html`<h2 class="topic__name">${name}</h2>` : html`<h3 class="topic__name">${name}</h3>`}
	<p class="topic__meta"><span class="visually-hidden">${facts.long}</span><span aria-hidden="true">${facts.short}</span></p>
</li>`;
};

/**
 * A topic as one line of the home page's directory: a small still, its name
 * as the link, its count and running time. The link covers the whole row.
 * @param {import("./layout.js").Site} site
 * @param {import("./layout.js").Tag} tag
 * @param {import("./layout.js").Video} still
 * @param {string} href
 * @param {string} root
 */
export const topicRow = (site, tag, still, href, root) => {
    const facts = listFacts(site.videos.filter((video) => video.tags.includes(tag.slug)));

    return html`<li class="topic-row">
	<span class="topic-row__image">${picture(site, still, root, { sizes: SIZES.row })}</span>
	<div class="topic-row__text">
		<h3 class="topic-row__name"><a class="topic-row__link" href="${href}">${tag.name}</a></h3>
		<p class="topic-row__meta"><span class="visually-hidden">${facts.long}</span><span aria-hidden="true"><span class="topic-row__count">${facts.count}</span>${facts.time && html`<span class="topic-row__time">${facts.time}</span>`}</span></p>
	</div>
</li>`;
};

/**
 * The order menu for a list. Its label is "Order"; the list's default is
 * selected, and the script sets it from the address.
 * @param {"newest" | "oldest"} defaultOrder
 */
export const sortControl = (defaultOrder) => html`<label class="sort">
					<span class="sort__label">Order</span>
					<span class="sort__wrap"><select class="sort__select" data-sort>
						<option value="newest">Newest first</option>
						<option value="oldest"${defaultOrder === "oldest" && raw(" selected")}>Oldest first</option>
					</select></span>
				</label>`;
