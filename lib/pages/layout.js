/**
 * What every page shares: the head with its security policy and sharing
 * details, the blue utility bar and white masthead, and the footer.
 */
import { createHash } from "node:crypto";
import { html, raw, smartQuotes } from "../html.js";
import { jsonLd } from "../seo.js";
import { tagName } from "../site.js";

export const SITE_NAME = "CSE Videos";
export const DEPARTMENT = "BYU-Idaho Computer Science and Engineering";
export const DEPARTMENT_URL = "https://www.byui.edu/computer-science-engineering/";
export const INSTAGRAM_URL = "https://www.instagram.com/byui.cse/";
export const YOUTUBE_URL = "https://www.youtube.com/@byui-cse";
// The same privacy and legal links as the byui.edu footer.
const PRIVACY_URL = "https://cesprivacy.org/ces-institutions-privacy-notice";
const LEGAL_URL = "https://www.byui.edu/legal/";

export const SOURCE_NAMES = { youtube: "YouTube", instagram: "Instagram" };

export const SEARCH_ICON = raw('<svg class="search-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M15.5 15.5 21 21" stroke="currentColor" stroke-width="2.4" stroke-linecap="square"/></svg>');

/**
 * Pages load only this site's own files, plus the two video players and
 * YouTube's thumbnails. An inline script runs only if the policy lists the
 * hash of its exact text. No page has a style attribute or a <style>, so
 * styles come from the site's stylesheet alone.
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

/**
 * @typedef {{
 *   id: string, title: string, description?: string, youtube?: string, instagram?: string,
 *   length?: string, attributions?: string[], datePosted: string, dateCreated?: string,
 *   tags: string[], series?: string, part?: number, stats?: Record<string, number>
 * }} Video
 * @typedef {{ slug: string, name: string, count: number }} Tag
 * @typedef {{
 *   videos: Video[], tags: Tag[], names: Record<string, string>,
 *   covers: Map<string, { width: number, height: number }>, siteUrl: string | null,
 *   scripts?: string[]
 * }} Site
 */

/**
 * The series the home page features, with its name: the one with the newest
 * part. Null when no video is part of a series.
 * @param {Site} site
 * @returns {{ slug: string, name: string } | null}
 */
export const featuredSeries = (site) => {
    const newest = [...site.videos]
        .filter((video) => video.series)
        .sort((a, b) => b.datePosted.localeCompare(a.datePosted))[0];

    return newest ? { slug: newest.series, name: tagName(newest.series, site.names) } : null;
};

/**
 * A header link. The page it points to gets aria-current="page"; pages
 * inside its section (a tag page under Topics, a video under All videos) get
 * the same underline.
 * @param {string} href
 * @param {unknown} label
 * @param {"videos" | "wall" | "tags"} key
 * @param {string | undefined} current
 * @param {string | undefined} section
 */
const navLink = (href, label, key, current, section) => {
    const here = current === key;
    const inside = !here && section === key;

    return html`<a class="site-nav__link${inside ? " site-nav__link--section" : ""}" href="${href}"${here && raw(' aria-current="page"')}>${label}</a>`;
};

/**
 * "Play videos on" in the utility bar: a soft, site-wide choice of player,
 * kept in the browser by src/js/source-preference.js. Only when some video is
 * on both YouTube and Instagram; otherwise there is nothing to choose. Needs
 * JavaScript, so it starts hidden.
 * @param {Video[]} videos
 */
const sourcePreference = (videos) => videos.some((video) => video.youtube && video.instagram)
    && html`<div class="source-preference" role="group" aria-labelledby="play-videos-on" data-source-preference data-needs-js hidden>
				<span class="source-preference__label" id="play-videos-on">Play videos on</span>
				<button class="source-preference__button" type="button" data-preference-button="youtube" aria-pressed="false">YouTube</button><span class="source-preference__divider" aria-hidden="true">|</span><button class="source-preference__button" type="button" data-preference-button="instagram" aria-pressed="false">Instagram</button>
			</div>`;

/**
 * The page shell: head, header, footer.
 *
 * The script blocks the first paint (blocking="render"), with every module it
 * imports preloaded beside it. Chromium otherwise paints a page while its
 * modules are still loading and drops the page-to-page view transition with
 * an uncaught "opt-in disabled" error; with the modules preloaded the wait is
 * one round trip, alongside the stylesheet's.
 * @param {{
 *   site: Site, root: string, path: string, title: string, description: string,
 *   body: unknown, current?: "videos" | "wall" | "tags", section?: "videos" | "tags", home?: boolean,
 *   image?: { src: string, width: number, height: number } | null, type?: string,
 *   structuredData?: object[], inlineScript?: string | null, preloads?: unknown,
 *   noindex?: boolean
 * }} page
 * @returns {string}
 */
export const layout = ({
    site, root, path, title, description, body, current, section, home = false,
    image = null, type = "website", structuredData = [], inlineScript = null, preloads = null,
    noindex = false
}) => {
    const canonical = site.siteUrl && !noindex ? `${site.siteUrl}${path}` : null;
    const sharingImage = image ?? { src: `${root}share.jpg`, width: 1200, height: 630 };
    const imageUrl = canonical ? new URL(sharingImage.src, canonical).href : null;
    title = smartQuotes(title);
    description = smartQuotes(description);
    const imageAlt = image ? title : SITE_NAME;
    const documentTitle = title === SITE_NAME ? `${SITE_NAME} | ${DEPARTMENT}` : `${title} | ${SITE_NAME}`;
    const series = featuredSeries(site);
    // On the home page these stay on the page, so a search in the address
    // isn't lost on the way to them.
    const homePart = (id) => (home ? `#${id}` : `${root}#${id}`);

    return `<!doctype html>\n${html`<html lang="en">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy(inlineScript)}">
	${inlineScript && html`<script>${raw(inlineScript)}</script>`}
	<title>${documentTitle}</title>
	<meta name="description" content="${description}">
	${noindex && html`<meta name="robots" content="noindex">`}
	${canonical && html`<link rel="canonical" href="${canonical}">
	<meta property="og:url" content="${canonical}">`}
	<meta property="og:site_name" content="${SITE_NAME}">
	<meta property="og:title" content="${title}">
	<meta property="og:description" content="${description}">
	<meta property="og:type" content="${type}">
	${imageUrl && html`<meta property="og:image" content="${imageUrl}">
	<meta property="og:image:width" content="${sharingImage.width}">
	<meta property="og:image:height" content="${sharingImage.height}">
	<meta property="og:image:alt" content="${imageAlt}">
	<meta name="twitter:card" content="${sharingImage.width > sharingImage.height ? "summary_large_image" : "summary"}">
	<meta name="twitter:image" content="${imageUrl}">
	<meta name="twitter:title" content="${title}">
	<meta name="twitter:description" content="${description}">`}
	${canonical && structuredData.map(jsonLd)}
	<meta name="color-scheme" content="light dark">
	<meta name="theme-color" content="#0065b0">
	<link rel="preload" href="${root}fonts/sofia-sans-semi-condensed-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
	<link rel="preload" href="${root}fonts/sofia-sans-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
	${preloads}
	<link rel="icon" href="${root}favicon.svg" type="image/svg+xml">
	<link rel="stylesheet" href="${root}css/main.css">
	${(site.scripts ?? []).map((name) => html`<link rel="modulepreload" href="${root}js/${name}">`)}
	<script type="module" src="${root}js/main.js" blocking="render"></script>
</head>
<body>
	<a class="skip-link" href="#main">Skip to content</a>

	<header class="site-header">
		<div class="utility">
			<div class="container utility__inner">
				<p class="utility__name"><span class="utility__long">${DEPARTMENT}</span><span class="utility__short">BYU-Idaho CSE</span></p>
				<ul class="utility__links">
					<li class="utility__department"><a href="${DEPARTMENT_URL}">Department site</a></li>
					<li><a href="${INSTAGRAM_URL}">Instagram</a></li>
					<li><a href="${YOUTUBE_URL}">YouTube</a></li>
				</ul>
				${sourcePreference(site.videos)}
			</div>
		</div>
		<div class="masthead">
			<div class="container masthead__inner">
				<a class="wordmark" href="${root}"><span class="wordmark__name">${SITE_NAME}</span> <span class="wordmark__department">Computer Science and Engineering</span></a>
				<nav class="site-nav" aria-label="Main">
					<ul class="site-nav__list">
						<li>${navLink(root, html`<span class="site-nav__wide">All videos</span><span class="site-nav__narrow">Videos</span>`, "videos", current, section)}</li>
						<li>${navLink(`${root}wall/`, html`<span class="site-nav__wide">Video wall</span><span class="site-nav__narrow">Wall</span>`, "wall", current, section)}</li>
						<li>${navLink(`${root}tags/`, "Topics", "tags", current, section)}</li>
						${series && html`<li class="site-nav__series"><a class="site-nav__link" href="${homePart(series.slug)}">${series.name}</a></li>`}
					</ul>
				</nav>
				<a class="search-button" href="${homePart("search")}" data-search-button data-needs-js hidden><span class="visually-hidden">Search the videos</span>${SEARCH_ICON}</a>
			</div>
		</div>
	</header>

	<main id="main" class="site-main">
${body}
	</main>

	<footer class="site-footer">
		<div class="site-footer__band">
			<div class="container site-footer__inner">
				<div class="site-footer__sign">
					<p class="site-footer__mark"><a href="${root}">${SITE_NAME}</a></p>
					<p class="site-footer__department">${DEPARTMENT}</p>
				</div>
				<div class="site-footer__columns">
					<div>
						<h2 class="site-footer__head">The department</h2>
						<ul class="site-footer__links">
							<li><a href="${DEPARTMENT_URL}">Department site</a></li>
							<li><a href="${INSTAGRAM_URL}">Instagram, @byui.cse</a></li>
							<li><a href="${YOUTUBE_URL}">YouTube, @byui-cse</a></li>
						</ul>
					</div>
					<div>
						<h2 class="site-footer__head">The library</h2>
						<ul class="site-footer__links">
							<li><a href="${homePart("all-videos")}">All videos</a></li>
							<li><a href="${root}wall/">Video wall</a></li>
							<li><a href="${root}tags/">Topics</a></li>
							${series && html`<li><a href="${homePart(series.slug)}">${series.name}</a></li>`}
						</ul>
					</div>
				</div>
			</div>
		</div>
		<div class="site-footer__legal">
			<div class="container site-footer__legal-inner">
				<p>Brigham Young University-Idaho, Rexburg, Idaho</p>
				<ul class="site-footer__legal-links">
					<li><a href="${PRIVACY_URL}">Privacy notice</a></li>
					<li><a href="${LEGAL_URL}">Legal and terms of use</a></li>
				</ul>
			</div>
		</div>
	</footer>
</body>
</html>
`}`;
};
