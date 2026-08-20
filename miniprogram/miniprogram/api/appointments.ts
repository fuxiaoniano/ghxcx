import { request } from './request';
import { Appointment } from './types';

export function createAppointment(data: {
  name: string;
  ageRange: string;
  missingTeethType: string;
  clinicId?: string;
  remark?: string;
  source?: string;
  privacyAccepted: boolean;
}) {
  return request<Appointment>({
    url: '/api/appointments',
    method: 'POST',
    auth: true,
    data
  });
}

export function getMyAppointments() {
  return request<Appointment[]>({ url: '/api/appointments/my', auth: true });
}

export function getMyAppointmentDetail(id: string) {
  return request<Appointment>({ url: `/api/appointments/my/${id}`, auth: true });
}
