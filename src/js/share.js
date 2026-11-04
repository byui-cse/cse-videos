/**
 * "Copy link" buttons. They copy the page's address as it is right now, so a
 * search, a sort order, or the chosen player all come along.
 */

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
    for (const button of document.querySelectorAll("[data-copy-link]")) {
        const status = button.parentElement?.querySelector("[data-copy-status]");
        const label = button.textContent;
        let timer;

        button.addEventListener("click", async () => {
            const copied = await copy(window.location.href);

            // The label says what happened, in place, so nothing shifts; the
            // hidden status says it to screen readers.
            button.textContent = copied ? "Link copied" : "Copy failed";

            if (status) {
                status.textContent = copied ? "Link copied" : "Couldn't copy. Copy the address from the address bar.";
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
