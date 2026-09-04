"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLandingPageConfig = getLandingPageConfig;
const request_1 = require("./request");
function getLandingPageConfig(pageKey) {
    const path = pageKey ? `/api/config/landing-page/${encodeURIComponent(pageKey)}` : '/api/config/landing-page';
    return (0, request_1.request)({ url: path });
}
