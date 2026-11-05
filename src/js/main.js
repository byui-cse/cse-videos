/**
 * Every page loads this. The pages are complete without it; it adds search,
 * sorting, copy link, and the player controls.
 */
import { initList } from "./list.js";
import { initPlayer } from "./player.js";
import { initShare } from "./share.js";
import { initBack } from "./back.js";

for (const element of document.querySelectorAll("[data-needs-js]")) {
    element.hidden = false;
}

initList();
initShare();
initPlayer();
initBack();
