"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLandingPageConfig = getLandingPageConfig;
const request_1 = require("./request");
function getLandingPageConfig() {
    return (0, request_1.request)({ url: '/api/config/landing-page' });
}
