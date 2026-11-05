/**
 * The pages of the site, built from the video list:
 *   index.html            every video, with search
 *   tags/index.html       every tag
 *   tags/<tag>/index.html the videos with one tag
 *   videos/<id>/index.html one video and its player
 *   404.html              for links that go nowhere
 * Links are relative, so the site works at any address.
 */
import { createHash } from "node:crypto";
import { html, linkify, plainText, raw, smartQuotes } from "./html.js";
import { breadcrumbs, jsonLd, videoObject, websiteSchema } from "./seo.js";
import {
    cover,
    embedUrls,
    formatDate,
    isoDuration,
    newestFirst,
    paragraphs,
    plural,
    popularTags,
    searchWords,
    sameText,
    spokenLength,
    statName,
    summary,
    tagName,
    youtubeShape
} from "./site.js";

const SITE_NAME = "CSE Videos";
const DEPARTMENT = "BYU-Idaho Computer Science and Engineering";
const DEPARTMENT_URL = "https://www.byui.edu/computer-science-engineering/";
const INSTAGRAM_URL = "https://www.instagram.com/byui.cse/";
const YOUTUBE_URL = "https://www.youtube.com/@byui-cse";
// The same privacy and legal links as the byui.edu footer.
const PRIVACY_URL = "https://cesprivacy.org/ces-institutions-privacy-notice";
const LEGAL_URL = "https://www.byui.edu/legal/";
const POPULAR_TAG_COUNT = 8;

// Instagram's player posts its first messages as soon as it loads, which on a
// fast connection is before js/main.js runs. This keeps them for the player
// (src/js/player.js), which replays them when it starts.
const INSTAGRAM_QUEUE = 'addEventListener("message", (event) => { if (event.origin === "https://www.instagram.com") { (window.instagramMessages ||= []).push({ data: event.data, source: event.source }); } });';

/**
 * Pages load only this site's own files, plus the two video players and
 * YouTube's thumbnails. An inline script runs only if the policy lists the
 * hash of its exact text.
 * @param {string | null} inlineScript
 */
const contentSecurityPolicy = (inlineScript) => [
    "default-src 'self'",
    "img-src 'self' https://i.ytimg.com",
    "frame-src https://www.youtube-nocookie.com https://www.instagram.com",
    inlineScript ? `script-src 'self' 'sha256-${createHash("sha256").update(inlineScript).digest("base64")}'` : "script-src 'self'",
    "style-src 'self'",
    "font-src 'self'",
    "connect-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'"
].join("; ");

const SOURCE_NAMES = { youtube: "YouTube", instagram: "Instagram" };

/**
 * @typedef {{
 *   id: string, title: string, description?: string, youtube?: string, instagram?: string,
 *   length?: string, attributions?: string[], datePosted: string, dateCreated?: string,
 *   tags: string[], series?: string, part?: number, stats?: Record<string, number>
 * }} Video
 * @typedef {{ slug: string, name: string, count: number }} Tag
 * @typedef {{
 *   videos: Video[], tags: Tag[], names: Record<string, string>,
 *   covers: Map<string, { width: number, height: number }>, siteUrl: string | null
 * }} Site
 */

/**
 * A header link. The page it points to gets aria-current="page"; pages inside
 * its section (a tag page under Tags, a video under Videos) get the same
 * underline, as on the CS & SE site.
 * @param {string} href
 * @param {string} label
 * @param {"videos" | "tags"} key
 * @param {string | undefined} current
 * @param {string | undefined} section
 */
const navLink = (href, label, key, current, section) => {
    const here = current === key;
    const inside = !here && section === key;

    return html`<a class="site-nav__link${inside ? " site-nav__link--section" : ""}" href="${href}"${here && raw(' aria-current="page"')}>${label}</a>`;
};

/**
 * "Play videos on" in the header: a soft, site-wide choice of player, kept in
 * the browser by src/js/source-preference.js. Only when some video is on both
 * YouTube and Instagram; otherwise there is nothing to choose. Needs
 * JavaScript, so it starts hidden.
 * @param {Video[]} videos
 */
const sourcePreference = (videos) => videos.some((video) => video.youtube && video.instagram)
    && html`<div class="source-preference" role="group" aria-labelledby="play-videos-on" data-source-preference data-needs-js hidden>
				<span class="source-preference__label" id="play-videos-on">Play videos on</span>
				<span class="source-preference__buttons">${Object.keys(SOURCE_NAMES).map((source) => html`<button class="source-preference__button" type="button" data-preference-button="${source}" aria-pressed="false">${SOURCE_NAMES[source]}</button>`)}</span>
			</div>`;

/**
 * The page shell: head, header, footer.
 * @param {{
 *   site: Site, root: string, path: string, title: string, description: string,
 *   body: unknown, current?: "videos" | "tags", section?: "videos" | "tags",
 *   image?: { src: string, width: number, height: number } | null, type?: string,
 *   structuredData?: object[], inlineScript?: string | null
 * }} page
 * @returns {string}
 */
const layout = ({ site, root, path, title, description, body, current, section, image = null, type = "website", structuredData = [], inlineScript = null }) => {
    const canonical = site.siteUrl ? `${site.siteUrl}${path}` : null;
    const imageUrl = image && canonical ? new URL(image.src, canonical).href : null;
    title = smartQuotes(title);
    description = smartQuotes(description);
    const documentTitle = title === SITE_NAME ? `${SITE_NAME} | ${DEPARTMENT}` : `${title} | ${SITE_NAME}`;

    return `<!doctype html>\n${html`<html lang="en">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy(inlineScript)}">
	${inlineScript && html`<script>${raw(inlineScript)}</script>`}
	<title>${documentTitle}</title>
	<meta name="description" content="${description}">
	${canonical && html`<link rel="canonical" href="${canonical}">
	<meta property="og:url" content="${canonical}">`}
	<meta property="og:site_name" content="${SITE_NAME}">
	<meta property="og:title" content="${title}">
	<meta property="og:description" content="${description}">
	<meta property="og:type" content="${type}">
	${imageUrl && html`<meta property="og:image" content="${imageUrl}">
	<meta property="og:image:width" content="${image.width}">
	<meta property="og:image:height" content="${image.height}">
	<meta property="og:image:alt" content="${title}">
	<meta name="twitter:card" content="${image.width > image.height ? "summary_large_image" : "summary"}">
	<meta name="twitter:image" content="${imageUrl}">
	<meta name="twitter:title" content="${title}">
	<meta name="twitter:description" content="${description}">`}
	${canonical && structuredData.map(jsonLd)}
	<meta name="theme-color" content="#004c86" media="(prefers-color-scheme: light)">
	<meta name="theme-color" content="#002647" media="(prefers-color-scheme: dark)">
	<link rel="preload" href="${root}fonts/source-sans-3-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
	<link rel="preload" href="${root}fonts/source-serif-4-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
	<link rel="stylesheet" href="${root}css/main.css">
	<script type="module" src="${root}js/main.js"></script>
</head>
<body>
	<a class="skip-link" href="#main">Skip to content</a>

	<header class="site-header">
		<div class="container site-header__inner">
			<a class="brand" href="${root}">
				<span class="brand__name">${SITE_NAME}</span>
				<span class="brand__dept">${DEPARTMENT}</span>
			</a>
			<nav class="site-nav" aria-label="Main">
				<ul class="site-nav__list">
					<li>${navLink(root, "Videos", "videos", current, section)}</li>
					<li>${navLink(`${root}tags/`, "Tags", "tags", current, section)}</li>
				</ul>
			</nav>
			${sourcePreference(site.videos)}
		</div>
	</header>

	<main id="main" class="site-main">
${body}
	</main>

	<footer class="site-footer">
		<div class="container site-footer__inner">
			<p class="site-footer__name">BYU-Idaho Department of Computer Science and Engineering</p>
			<ul class="site-footer__links">
				<li><a href="${DEPARTMENT_URL}">Department website</a></li>
				<li><a href="${YOUTUBE_URL}">YouTube</a></li>
				<li><a href="${INSTAGRAM_URL}">Instagram</a></li>
				<li><a href="${PRIVACY_URL}">Privacy</a></li>
				<li><a href="${LEGAL_URL}">Legal</a></li>
			</ul>
		</div>
	</footer>
</body>
</html>
`}`;
};

/**
 * A <time> for a date.
 * @param {string} isoDate
 * @param {"long" | "medium"} [style]
 */
const dateTime = (isoDate, style = "long") => html`<time datetime="${isoDate}">${formatDate(isoDate, style)}</time>`;

/**
 * A <time> for a length, read out in words ("1 minute 5 seconds").
 * @param {string} length
 */
const lengthTime = (length) =>
    html`<time datetime="${isoDuration(length)}"><span aria-hidden="true">${length}</span><span class="visually-hidden">${spokenLength(length)}</span></time>`;

/**
 * "Copy link". The button's own label confirms the copy, so nothing around it
 * moves; a hidden status line tells screen readers. Needs JavaScript, so it
 * starts hidden.
 */
const copyLink = () => html`<span class="copy-link" data-needs-js hidden>
	<button class="button button--secondary button--small copy-link__button" type="button" data-copy-link>Copy link</button>
	<span class="visually-hidden" data-copy-status role="status"></span>
</span>`;

/**
 * @param {Tag | { slug: string, name: string }} tag
 * @param {string} root
 */
const tagChip = (tag, root) => html`<li><a class="chip" href="${root}tags/${tag.slug}/">${tag.name}</a></li>`;

/**
 * One video in a grid. The title link covers the whole card.
 * @param {Site} site
 * @param {Video} video
 * @param {string} root
 * @param {number} order position in the newest-first list
 */
const videoCard = (site, video, root, order) => {
    const picture = cover(video, site.covers.get(video.id), root);

    return html`<li class="video-card" data-search="${searchWords(video, site.names)}" data-order="${order}">
	<div class="video-card__cover">${picture
        ? html`<img src="${picture.src}" alt="" width="${picture.width}" height="${picture.height}" loading="lazy" decoding="async">`
        : html`<span class="video-card__no-cover">No cover image</span>`}</div>
	<h3 class="video-card__title"><a class="video-card__link" href="${root}videos/${video.id}/">${smartQuotes(video.title)}</a></h3>
	<p class="video-card__meta">${dateTime(video.datePosted, "medium")}${video.length && html`<span aria-hidden="true"> · </span>${lengthTime(video.length)}`}</p>
</li>`;
};

/**
 * A heading, the count, sort and copy link, and the grid of videos.
 * On a tag page the heading is for screen readers only, since the band above
 * already names the tag. The cards start in the list's default order, and
 * each keeps its newest-first position in data-order for the sort.
 * @param {Site} site
 * @param {Video[]} videos newest first
 * @param {string} root
 * @param {{ heading: string, search?: boolean, headingVisible?: boolean, defaultOrder?: "newest" | "oldest" }} options
 */
const videoListing = (site, videos, root, { heading, search = false, headingVisible = true, defaultOrder = "newest" }) => {
    const oldestFirst = defaultOrder === "oldest";
    const cards = videos.map((video, index) => videoCard(site, video, root, index));

    return html`<section class="section listing" aria-labelledby="listing-heading">
	<div class="container">
		<div class="listing__head">
			<h2 class="${headingVisible ? "listing__heading" : "visually-hidden"}" id="listing-heading" tabindex="-1">${heading}</h2>
			<p class="listing__count" data-results>${plural(videos.length, "video")}</p>
			<p class="visually-hidden" data-announce role="status"></p>
			<div class="listing__tools" data-needs-js hidden>
				<label class="sort">
					<span class="sort__label">Sort</span>
					<select class="sort__select" data-sort>
						<option value="newest">Newest first</option>
						<option value="oldest"${oldestFirst && raw(" selected")}>Oldest first</option>
					</select>
				</label>
				${copyLink()}
			</div>
		</div>
		<ul class="video-grid" data-video-list${oldestFirst && raw(' data-default-order="oldest"')}>
			${oldestFirst ? cards.reverse() : cards}
		</ul>
		${search && html`<div class="listing__empty" data-empty hidden>
			<p>Try a shorter word, <a href="${root}" data-clear-search>show every video</a>, or <a href="${root}tags/">browse the tags</a>.</p>
		</div>`}
	</div>
</section>`;
};

/**
 * @param {Site} site
 * @returns {string}
 */
export const homePage = (site) => {
    // "./" rather than "": an empty link would keep a search in the address,
    // so the site name and Videos link wouldn't clear it.
    const root = "./";
    const popular = popularTags(site.tags, POPULAR_TAG_COUNT);

    const body = html`<section class="band intro" aria-labelledby="page-title">
	<div class="container intro__inner">
		<div class="intro__text visually-hidden--on-phone">
			<h1 class="intro__title" id="page-title">${SITE_NAME}</h1>
			<p class="lede intro__lede">Short videos from the BYU-Idaho Computer Science and Engineering department. Search for a topic or pick a tag, then share the link with a student.</p>
		</div>
		<div class="intro__find">
			<form class="search" role="search" action="./" method="get" data-search-form data-needs-js hidden>
				<label class="search__label" for="search-input">Search videos</label>
				<div class="search__row">
					<input class="search__input" id="search-input" name="q" type="search" autocomplete="off" enterkeyhint="search" spellcheck="false" data-search-input>
					<button class="button button--on-band" type="submit">Search</button>
				</div>
			</form>
			${popular.length > 0 && html`<div class="quick-tags">
				<h2 class="quick-tags__heading" id="quick-tags-heading">Most used tags</h2>
				<ul class="chips chips--on-band" aria-labelledby="quick-tags-heading">
					${popular.map((tag) => tagChip(tag, root))}
				</ul>
				<p class="quick-tags__all"><a href="${root}tags/">See all ${plural(site.tags.length, "tag")}</a></p>
			</div>`}
		</div>
	</div>
</section>

${videoListing(site, newestFirst(site.videos), root, { heading: "All videos", search: true })}`;

    return layout({
        site,
        root,
        path: "",
        title: SITE_NAME,
        description: "Videos from the BYU-Idaho Department of Computer Science and Engineering. Search them, browse them by tag, and share a link to any one.",
        body,
        current: "videos",
        structuredData: site.siteUrl ? [websiteSchema(site.siteUrl)] : []
    });
};

/**
 * @param {Site} site
 * @returns {string}
 */
export const tagsPage = (site) => {
    const root = "../";

    const body = html`<section class="band page-head" aria-labelledby="page-title">
	<div class="container">
		<h1 class="page-head__title" id="page-title">Tags</h1>
		<p class="page-head__note">${plural(site.tags.length, "tag")}, A to Z. Each one opens its videos.</p>
	</div>
</section>

<section class="section">
	<div class="container">
		<ul class="tag-index">
			${site.tags.map((tag) => html`<li class="tag-index__item">
				<a class="tag-index__link" href="${tag.slug}/">${tag.name}</a>
				<span class="tag-index__count">${plural(tag.count, "video")}</span>
			</li>`)}
		</ul>
	</div>
</section>`;

    return layout({
        site,
        root,
        path: "tags/",
        title: "Tags",
        description: `Every tag on CSE Videos, the BYU-Idaho Computer Science and Engineering video library: ${site.tags.map((tag) => tag.name).join(", ")}.`,
        body,
        current: "tags"
    });
};

/**
 * @param {Site} site
 * @param {Tag} tag
 * @returns {string}
 */
export const tagPage = (site, tag) => {
    const root = "../../";
    const videos = newestFirst(site.videos.filter((video) => video.tags.includes(tag.slug)));
    const newest = videos[0];
    // A series tag, like Career Quest, opens on Part 1.
    const series = videos.length > 0 && videos.every((video) => video.series === tag.slug);

    const body = html`<section class="band page-head" aria-labelledby="page-title">
	<div class="container">
		<h1 class="page-head__title" id="page-title">${tag.name}</h1>
		<p class="page-head__note">${series && html`${plural(videos.length, "part")}<span aria-hidden="true"> · </span>`}<a href="../">See all tags</a></p>
	</div>
</section>

${videoListing(site, videos, root, { heading: `Videos tagged ${tag.name}`, headingVisible: false, defaultOrder: series ? "oldest" : "newest" })}`;

    return layout({
        site,
        root,
        path: `tags/${tag.slug}/`,
        title: `${tag.name} videos`,
        description: `${plural(videos.length, "video")} tagged ${tag.name} from the BYU-Idaho Computer Science and Engineering department.`,
        body,
        section: "tags",
        image: newest ? cover(newest, site.covers.get(newest.id), root) : null,
        structuredData: site.siteUrl ? [breadcrumbs([
            { name: "Tags", url: `${site.siteUrl}tags/` },
            { name: tag.name, url: `${site.siteUrl}tags/${tag.slug}/` }
        ])] : []
    });
};

/**
 * The player: the embed over the cover, and below it the source switch and Expand.
 * @param {Video} video
 * @param {{ src: string, width: number, height: number } | null} poster
 */
const player = (video, poster) => {
    const urls = embedUrls(video);
    const sources = /** @type {("youtube" | "instagram")[]} */ (Object.keys(urls));
    const first = sources[0];
    const shape = video.youtube ? youtubeShape(video.youtube) : "tall";

    return html`<div class="player" data-player data-source="${first}" data-youtube-shape="${shape}" data-title="${smartQuotes(video.title)}"${sources.map((source) => html` data-${source}-src="${urls[source]}"`)}>
	<div class="player__frame">
		${poster && html`<img class="player__poster" src="${poster.src}" alt="" width="${poster.width}" height="${poster.height}">`}
		<iframe class="player__iframe" src="${urls[first]}" title="${smartQuotes(video.title)} (${SOURCE_NAMES[first]})" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
	</div>
	<div class="player__bar" data-needs-js hidden>
		${sources.length > 1 && html`<div class="player__sources" role="group" aria-labelledby="watch-on">
			<span class="player__sources-label" id="watch-on">Watch on</span>
			${sources.map((source) => html`<button class="player__source" type="button" data-source-button="${source}" aria-pressed="${String(source === first)}">${SOURCE_NAMES[source]}</button>`)}
		</div>`}
		<button class="button button--small player__expand" type="button" data-expand>Expand</button>
	</div>
</div>`;
};

/**
 * @param {Site} site
 * @param {Video} video
 * @returns {string}
 */
export const videoPage = (site, video) => {
    const root = "../../";
    const stats = Object.entries(video.stats ?? {});
    const picture = cover(video, site.covers.get(video.id), root);
    const caption = video.description?.trim() ?? "";
    const seriesLabel = video.series && video.part ? `${video.series} Part ${video.part}` : "";
    const usableCaption = caption && !sameText(caption, video.title)
        && !(seriesLabel && sameText(caption, seriesLabel))
        && !/^[\p{L}\p{N} &'’–—-]+\s*[-–—,:]\s*Part\s+\d+\s*:?[\s]*$/iu.test(caption);
    const length = video.length
        ? spokenLength(video.length).replace(/(hours|minutes|seconds)/g, (unit) => unit.slice(0, -1)).replaceAll(" ", "-")
        : "";
    const fallback = `A${length ? ` ${length}` : ""} video from BYU-Idaho Computer Science and Engineering, posted ${formatDate(video.datePosted)}.`;
    const description = usableCaption ? summary(plainText(caption)) : fallback;

    const body = html`<div class="section video-page">
	<div class="container">
		<p class="video-page__back"><a href="${root}" data-back>All videos</a></p>
		<article class="video">
			${player(video, picture)}
			<div class="video__details">
				<h1 class="video__title">${smartQuotes(video.title)}</h1>
				<p class="video__meta">Posted ${dateTime(video.datePosted)}${video.length && html`<span aria-hidden="true"> · </span>${lengthTime(video.length)}`}${video.dateCreated && html`<span aria-hidden="true"> · </span>Made ${dateTime(video.dateCreated)}`}</p>
				<div class="video__actions">
					${copyLink()}
					${video.youtube && html`<a class="button button--secondary button--small" href="${video.youtube}">Open on YouTube</a>`}
					${video.instagram && html`<a class="button button--secondary button--small" href="${video.instagram}">Open on Instagram</a>`}
				</div>
				${usableCaption && html`<div class="video__description prose">
					${paragraphs(video.description).map((lines) => html`<p>${lines.map((line, index) => html`${index > 0 && raw("<br>")}${linkify(smartQuotes(line))}`)}</p>`)}
				</div>`}
				<section class="video__section" aria-labelledby="video-tags">
					<h2 class="video__subhead" id="video-tags">Tags</h2>
					<ul class="chips">
						${video.tags.map((slug) => tagChip({ slug, name: tagName(slug, site.names) }, root))}
					</ul>
				</section>
				${video.attributions?.length > 0 && html`<section class="video__section" aria-labelledby="video-credits">
					<h2 class="video__subhead" id="video-credits">Credits</h2>
					<ul class="plain-list">
						${video.attributions.map((credit) => html`<li>${linkify(smartQuotes(credit))}</li>`)}
					</ul>
				</section>`}
				${stats.length > 0 && html`<section class="video__section" aria-labelledby="video-stats">
					<h2 class="video__subhead" id="video-stats">Stats</h2>
					<dl class="facts">
						${stats.map(([key, count]) => html`<div class="facts__row"><dt>${statName(key)}</dt><dd>${count}</dd></div>`)}
					</dl>
				</section>`}
			</div>
		</article>
	</div>
</div>`;

    return layout({
        site,
        root,
        path: `videos/${video.id}/`,
        title: video.title,
        description,
        body,
        section: "videos",
        image: picture,
        type: "video.other",
        inlineScript: video.instagram ? INSTAGRAM_QUEUE : null,
        structuredData: site.siteUrl ? [
            videoObject({
                video,
                thumbnailUrl: picture ? new URL(picture.src, `${site.siteUrl}videos/${video.id}/`).href : null,
                url: `${site.siteUrl}videos/${video.id}/`
            }),
            breadcrumbs([
                { name: "Videos", url: site.siteUrl },
                { name: video.title, url: `${site.siteUrl}videos/${video.id}/` }
            ])
        ] : []
    });
};

/**
 * GitHub Pages serves this for any missing address, at any depth, so its
 * links start from the site's root path instead of being relative. (A <base>
 * would also send the skip link's #main to the home page.)
 * @param {Site} site
 * @returns {string}
 */
export const notFoundPage = (site) => {
    const root = site.siteUrl ? new URL(site.siteUrl).pathname : "/";

    return layout({
        site,
        root,
        path: "404.html",
        title: "Page not found",
        description: "This address doesn't go to a video or a tag.",
        body: html`<section class="band page-head page-head--alone" aria-labelledby="page-title">
	<div class="container">
		<h1 class="page-head__title" id="page-title">Page not found</h1>
		<p class="page-head__note">This address doesn't go to a video or a tag. The link may have a typo, or the video may have moved.</p>
		<p><a class="button button--on-band" href="${root}">See all videos</a></p>
	</div>
</section>`
    });
};
