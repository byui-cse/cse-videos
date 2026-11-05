/**
 * Every page loads this. The pages are complete without it; it adds search,
 * sorting, copy link, the player controls, and the choice of player.
 */
import { initList } from "./list.js";
import { initPlayer } from "./player.js";
import { initShare } from "./share.js";
import { initBack } from "./back.js";
import { initSourcePreference } from "./source-preference.js";

for (const element of document.querySelectorAll("[data-needs-js]")) {
    element.hidden = false;
}

initList();
initShare();
initSourcePreference(initPlayer());
initBack();
