/**
 * Structured data and crawler files: schema.org JSON-LD for pages,
 * sitemap.xml, and robots.txt. Only real fields from the data are used.
 */
import { escapeHtml, plainText, raw } from "./html.js";
import { embedUrls, isoDuration } from "./site.js";

/** @param {unknown} data */
export const jsonLd = (data) => raw(`<script type="application/ld+json">${JSON.stringify(data).replace(/[<>&\u2028\u2029]/g, (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`)}</script>`);

/**
 * @param {{ video: object, thumbnailUrl?: string | null, url?: string | null }} options
 */
export const videoObject = ({ video, thumbnailUrl, url }) => {
    const embeds = embedUrls(video);

    return {
        "@context": "https://schema.org",
        "@type": "VideoObject",
        ...(video.title && { name: video.title }),
        ...((video.description || video.title) && { description: plainText(video.description || video.title) }),
        ...(thumbnailUrl && { thumbnailUrl }),
        ...(video.datePosted && { uploadDate: video.datePosted }),
        ...(video.length && { duration: isoDuration(video.length) }),
        ...((embeds.youtube || embeds.instagram) && { embedUrl: embeds.youtube || embeds.instagram }),
        ...(url && { url }),
        publisher: {
            "@type": "Organization",
            name: "BYU-Idaho Computer Science and Engineering",
            url: "https://www.byui.edu/computer-science-engineering/"
        }
    };
};

/** @param {string} url */
export const websiteSchema = (url) => ({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "CSE Videos",
    url,
    potentialAction: {
        "@type": "SearchAction",
        target: `${url}?q={search_term_string}`,
        "query-input": "required name=search_term_string"
    }
});

/** @param {{ name: string, url: string }[]} items */
export const breadcrumbs = (items) => ({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map(({ name, url }, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name,
        item: url
    }))
});

/** @param {{ url: string, lastmod?: string }[]} entries */
export const sitemapXml = (entries) => `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.map(({ url, lastmod }) => `    <url><loc>${escapeHtml(url)}</loc>${lastmod ? `<lastmod>${escapeHtml(lastmod)}</lastmod>` : ""}</url>`).join("\n")}\n</urlset>\n`;

/** @param {string | null} siteUrl */
export const robotsTxt = (siteUrl) => `User-agent: *\nAllow: /\n${siteUrl ? `Sitemap: ${siteUrl}sitemap.xml\n` : ""}`;
