/**
 * The page for addresses that go nowhere.
 */
import { html } from "../html.js";
import { layout } from "./layout.js";

/**
 * GitHub Pages serves this for any missing address, at any depth, so its
 * links start from the site's root path instead of being relative. (A <base>
 * would also send the skip link's #main to the home page.)
 * @param {import("./layout.js").Site} site
 * @returns {string}
 */
export const notFoundPage = (site) => {
    const root = site.siteUrl ? new URL(site.siteUrl).pathname : "/";

    return layout({
        site,
        root,
        path: "404.html",
        title: "Page not found",
        description: "This address doesn’t go to a video or a tag.",
        body: html`<section class="missing" aria-labelledby="page-title">
	<div class="container">
		<h1 class="missing__line" id="page-title">This address doesn’t go to a video or a tag</h1>
		<p><a class="button button--light" href="${root}">See all videos</a></p>
	</div>
</section>`
    });
};
