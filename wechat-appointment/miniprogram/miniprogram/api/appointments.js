"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAppointment = createAppointment;
exports.getMyAppointments = getMyAppointments;
exports.getMyAppointmentDetail = getMyAppointmentDetail;
const request_1 = require("./request");
function createAppointment(data) {
    return (0, request_1.request)({
        url: '/api/appointments',
        method: 'POST',
        auth: true,
        data
    });
}
function getMyAppointments() {
    return (0, request_1.request)({ url: '/api/appointments/my', auth: true });
}
function getMyAppointmentDetail(id) {
    return (0, request_1.request)({ url: `/api/appointments/my/${id}`, auth: true });
}
