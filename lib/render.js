/**
 * The pages of the site, built from the video list:
 *   index.html             the wall, every video with search, topics, the series
 *   tags/index.html        every topic
 *   tags/<tag>/index.html  the videos with one topic
 *   videos/<id>/index.html one video and its player
 *   404.html               for links that go nowhere
 * Each page is in lib/pages/. Links are relative, so the site works at any
 * address.
 */
export { homePage } from "./pages/home.js";
export { notFoundPage } from "./pages/not-found.js";
export { tagPage, tagsPage } from "./pages/tags.js";
export { videoPage } from "./pages/video.js";
