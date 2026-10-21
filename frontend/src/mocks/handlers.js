import { catalogHandlers } from "./catalog";
import { shopHandlers } from "./shop";
import { recoHandlers } from "./reco";
import { adminHandlers } from "./admin";
import { aiHandlers } from "./ai";

/*
 * Mocks MSW (VITE_USE_MOCK=true) : toute l'API utilisée par le frontend, au même
 * format que le backend, construite à partir des fixtures partagées (/fixtures).
 * Données en mémoire et dans sessionStorage : voir data.js.
 */
export const handlers = [
    ...catalogHandlers,
    ...shopHandlers,
    ...recoHandlers,
    ...adminHandlers,
    ...aiHandlers,
];
