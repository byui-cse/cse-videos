/**
 * Link buttons share on phones and copy elsewhere. They use the page's
 * address as it is right now, including a search or chosen player.
 */
import { shareMode } from "./state.js";

/**
 * For browsers that block the clipboard API (some in-app browsers do).
 * @param {string} text
 * @returns {boolean}
 */
const copyWithSelection = (text) => {
    // Selecting the text moves focus; put it back where the person was.
    const previous = /** @type {HTMLElement | null} */ (document.activeElement);
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.className = "visually-hidden";
    document.body.append(field);
    field.select();

    let copied = false;

    try {
        copied = document.execCommand("copy");
    } catch {
        copied = false;
    }

    field.remove();
    previous?.focus({ preventScroll: true });
    return copied;
};

/**
 * @param {string} text
 * @returns {Promise<boolean>}
 */
const copy = async (text) => {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        return copyWithSelection(text);
    }
};

export const initShare = () => {
    const mode = shareMode({
        canShare: typeof navigator.share === "function",
        coarsePointer: window.matchMedia?.("(pointer: coarse)")?.matches ?? false
    });

    for (const button of document.querySelectorAll("[data-copy-link]")) {
        const status = button.parentElement?.querySelector("[data-copy-status]");
        const label = mode === "share" ? "Share" : button.textContent;
        let timer;

        button.textContent = label;

        button.addEventListener("click", async () => {
            let message;
            let statusMessage;

            if (mode === "share") {
                try {
                    await navigator.share({
                        title: document.querySelector("h1")?.textContent?.trim() || document.title,
                        url: window.location.href
                    });
                    message = "Link shared";
                    statusMessage = message;
                } catch (error) {
                    if (error?.name === "AbortError") {
                        return;
                    }
                }
            }

            if (!message) {
                const copied = await copy(window.location.href);
                message = copied ? "Link copied" : "Copy failed";
                statusMessage = copied ? message : "Couldn't copy. Copy the address from the address bar.";
            }

            // The label says what happened, in place, so nothing shifts; the
            // hidden status says it to screen readers.
            button.textContent = message;

            if (status) {
                status.textContent = statusMessage;
            }

            clearTimeout(timer);
            timer = setTimeout(() => {
                button.textContent = label;

                if (status) {
                    status.textContent = "";
                }
            }, 3000);
        });
    }
};
