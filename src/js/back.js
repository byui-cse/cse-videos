/**
 * Return to the list page that led to this video.
 */
import { backTarget } from "./state.js";

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
    } else if (target.kind === "tag") {
        const tagPage = new URL(target.href);
        const tagLink = [...document.querySelectorAll("a[href]")]
            .find((tag) => tag !== link && tag.origin === tagPage.origin && tag.pathname === tagPage.pathname);
        link.textContent = tagLink ? `Back to ${tagLink.textContent.trim()}` : "Back to tag";
    }

    link.addEventListener("click", (event) => {
        if (history.length > 1) {
            event.preventDefault();
            history.back();
        }
    });
};
