/**
 * "Play videos on" in the header: a site-wide, soft choice of player. Videos
 * open on it when they have it (src/js/player.js), and on a video page with
 * both players it switches the one playing.
 */
import { onPreferenceChange, readPreference, savePreference } from "./preference.js";

/**
 * @param {{ prefer: (source: string) => void } | null} player this page's player, if it has one
 */
export const initSourcePreference = (player) => {
    const control = document.querySelector("[data-source-preference]");

    if (!control) {
        return;
    }

    const buttons = [...control.querySelectorAll("[data-preference-button]")];

    /** @param {string | null} source */
    const mark = (source) => {
        for (const button of buttons) {
            button.setAttribute("aria-pressed", String(button.getAttribute("data-preference-button") === source));
        }
    };

    mark(readPreference());
    // The player's own Watch on buttons save a preference too.
    onPreferenceChange(mark);

    for (const button of buttons) {
        button.addEventListener("click", () => {
            const source = button.getAttribute("data-preference-button") ?? "";
            savePreference(source);
            player?.prefer(source);
        });
    }
};
