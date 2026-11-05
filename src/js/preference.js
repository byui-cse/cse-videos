/**
 * The viewer's preferred player, YouTube or Instagram, kept in this browser's
 * storage under one key. It never leaves the browser. Storage can be missing
 * or blocked (private windows, in-app browsers, strict settings), so every
 * access is guarded and a failure just means no preference.
 */
import { isSource } from "./state.js";

const KEY = "cse-videos:source";
const listeners = new Set();

/**
 * The saved preference, or null when there is none, it isn't a known player,
 * or storage can't be read.
 * @returns {"youtube" | "instagram" | null}
 */
export const readPreference = () => {
    try {
        const value = window.localStorage.getItem(KEY);
        return isSource(value) ? value : null;
    } catch {
        return null;
    }
};

/**
 * Saves a preference and tells this page's listeners. Unknown values are
 * ignored. If storage is blocked the page still updates; the choice just
 * isn't remembered for the next page.
 * @param {string} source
 */
export const savePreference = (source) => {
    if (!isSource(source)) {
        return;
    }

    try {
        window.localStorage.setItem(KEY, source);
    } catch {
        // Blocked or full storage: nothing to keep it in.
    }

    for (const listener of listeners) {
        listener(source);
    }
};

/**
 * Runs `listener` with each preference saved on this page.
 * @param {(source: "youtube" | "instagram") => void} listener
 */
export const onPreferenceChange = (listener) => {
    listeners.add(listener);
};
