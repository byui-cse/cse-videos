/**
 * Return to the list page that led to this video (the home page, the Video
 * wall, or a tag page). A plain click goes back in the history, so the list
 * keeps its place; anything else follows the link.
 */
import { backTarget, isPlainClick } from "./state.js";

export const initBack = () => {
    const link = document.querySelector("[data-back]");

    if (!link) {
        return;
    }

    const target = backTarget(document.referrer, window.location.href);

    if (!target) {
        return;
    }

    link.href = target.href;

    if (target.kind === "results") {
        link.textContent = "Back to results";
    } else if (target.kind === "wall") {
        link.textContent = "Back to the video wall";
    } else if (target.kind === "tag") {
        const tagPage = new URL(target.href);
        const tagLink = [...document.querySelectorAll("a[href]")]
            .find((tag) => tag !== link && tag.origin === tagPage.origin && tag.pathname === tagPage.pathname);
        link.textContent = tagLink ? `Back to ${tagLink.textContent.trim()}` : "Back to tag";
    }

    // Mark the entry this page first loaded into, if there is an entry before
    // it: that one is the list page. A reload or a return through the history
    // keeps the mark; entries added later, like #main from the skip link, have
    // none. A page opened in a new tab has nothing to go back to.
    const [arrival] = performance.getEntriesByType("navigation");

    if (arrival?.type === "navigate" && history.length > 1) {
        history.replaceState({ ...history.state, backEntry: true }, "");
    }

    let leaving = false;

    // A page restored from the back-forward cache is no longer leaving.
    window.addEventListener("pageshow", () => {
        leaving = false;
    });

    link.addEventListener("click", (event) => {
        if (!isPlainClick(event) || history.state?.backEntry !== true) {
            return;
        }

        event.preventDefault();

        // A second click before the list page shows would go back twice.
        if (!leaving) {
            leaving = true;
            history.back();
        }
    });
};
