/**
 * Link buttons share on phones and copy elsewhere. A page's own button
 * ([data-copy-link]) uses the address as it is right now, including a search,
 * order or chosen player; a button for another page ([data-copy], like Copy
 * link under a still) uses the link it names.
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

/**
 * The hidden status line that tells screen readers what a button did: the
 * one beside the page's own button, or one made for the page.
 * @param {Element} button
 * @returns {Element}
 */
const statusFor = (button) => {
    const near = button.parentElement?.querySelector("[data-copy-status]");
    const status = near ?? document.querySelector("[data-copy-status]");

    if (status) {
        return status;
    }

    const made = document.createElement("p");
    made.className = "visually-hidden";
    made.setAttribute("role", "status");
    made.setAttribute("data-copy-status", "");
    document.body.append(made);
    return made;
};

/**
 * The text node that holds a button's visible label.
 * @param {HTMLElement} button
 * @returns {ChildNode}
 */
const labelNode = (button) => {
    const node = [...button.childNodes].find((child) => child.nodeType === Node.TEXT_NODE && child.textContent.trim() !== "");

    if (node) {
        return node;
    }

    const made = document.createTextNode(button.textContent ?? "");
    button.replaceChildren(made);
    return made;
};

/**
 * The page's address in pieces that each keep together: the site, then one
 * piece per folder. A long address then wraps after a slash, never at the
 * hyphen inside "cse-videos", which would read as a broken path. Shared with
 * the build, which writes the video page's link to send with it, so the
 * address breaks in the same places whether the page was built with its
 * public address or shows the one it was opened at.
 * @param {string} address
 * @returns {string[]}
 */
export const addressParts = (address) => address.match(/^[a-z][a-z\d+.-]*:\/\/[^/]*\/?|[^/]+\/?/gi) ?? [address];

export const initShare = () => {
    // A page built without its public address shows the one it was opened at.
    for (const node of document.querySelectorAll("[data-page-url]")) {
        if (!/^https?:/.test(node.textContent ?? "")) {
            const parts = addressParts(`${window.location.origin}${window.location.pathname}`);
            node.replaceChildren(...parts.map((text) => Object.assign(document.createElement("span"), { textContent: text })));
        }
    }

    const mode = shareMode({
        canShare: typeof navigator.share === "function",
        coarsePointer: window.matchMedia?.("(pointer: coarse)")?.matches ?? false
    });

    const buttons = /** @type {HTMLElement[]} */ ([...document.querySelectorAll("[data-copy-link], [data-copy]")]);

    for (const button of buttons) {
        const label = labelNode(button);
        const restLabel = mode === "share" ? "Share" : label.textContent;
        const suffix = button.querySelector("[data-copy-suffix]");
        const name = button.getAttribute("data-copy-name");
        let timer;

        label.textContent = restLabel;

        // "Copy link to X" reads as "Share X" once the button shares.
        if (mode === "share" && suffix && name) {
            suffix.textContent = ` ${name}`;
        }

        button.addEventListener("click", async () => {
            const target = button.hasAttribute("data-copy")
                ? new URL(button.getAttribute("data-copy") ?? "", window.location.href).href
                : window.location.href;
            const status = statusFor(button);
            let message;
            let statusMessage;

            if (mode === "share") {
                try {
                    await navigator.share({ title: name ?? document.title, url: target });
                    message = "Link shared";
                    statusMessage = message;
                } catch (error) {
                    if (error?.name === "AbortError") {
                        return;
                    }
                }
            }

            if (!message) {
                const copied = await copy(target);
                message = copied ? "Link copied" : "Copy failed";
                statusMessage = copied
                    ? message
                    : button.hasAttribute("data-copy") ? "Couldn't copy the link." : "Couldn't copy. Copy the address from the address bar.";
            }

            // The label says what happened, in place; the hidden status says
            // it to screen readers.
            label.textContent = message;
            status.textContent = statusMessage;

            clearTimeout(timer);
            timer = setTimeout(() => {
                label.textContent = restLabel;
                status.textContent = "";
            }, 3000);
        });
    }
};
