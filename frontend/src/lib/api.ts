const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export class ApiError extends Error {
  status: number;
  data: any;
  constructor(status: number, message: string, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('techx_token');
}

export function setToken(token: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('techx_token', token);
  }
}

export function removeToken() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('techx_token');
    localStorage.removeItem('techx_user');
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errorDetail = 'API request failed';
    let errorData = null;
    try {
      errorData = await res.json();
      errorDetail = errorData.detail || errorData.message || JSON.stringify(errorData);
    } catch {
      errorDetail = await res.text();
    }
    throw new ApiError(res.status, errorDetail, errorData);
  }

  return res.json();
}

export const api = {
  // Auth
  login: (data: { email: string; password: string }) =>
    request<any>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  getMe: () => request<any>('/auth/me'),

  // Events
  getEvents: (params?: { status?: string; type?: string; search?: string }) => {
    const q = new URLSearchParams();
    if (params?.status) q.append('status', params.status);
    if (params?.type) q.append('type', params.type);
    if (params?.search) q.append('search', params.search);
    return request<any[]>(`/events?${q.toString()}`);
  },
  getEvent: (id: number) => request<any>(`/events/${id}`),
  createEvent: (data: any) =>
    request<any>('/events', { method: 'POST', body: JSON.stringify(data) }),
  updateEvent: (id: number, data: any) =>
    request<any>(`/events/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  changeEventStatus: (id: number, status: string) =>
    request<any>(`/events/${id}/status/${status}`, { method: 'POST' }),

  // Registrations
  getRegistrations: (eventId: number) =>
    request<any[]>(`/events/${eventId}/registrations`),
  registerStudent: (eventId: number, studentId: number) =>
    request<any>(`/events/${eventId}/registrations`, {
      method: 'POST',
      body: JSON.stringify({ student_id: studentId }),
    }),
  bulkRegister: (eventId: number, studentIds: number[]) =>
    request<any>(`/events/${eventId}/registrations/bulk`, {
      method: 'POST',
      body: JSON.stringify({ student_ids: studentIds }),
    }),
  removeRegistration: (eventId: number, studentId: number) =>
    request<any>(`/events/${eventId}/registrations/${studentId}`, { method: 'DELETE' }),

  // Attendance Scanning
  scanAttendance: (eventId: number, data: { student_identifier: string; scan_method?: string; device_id?: string }) =>
    request<any>(`/events/${eventId}/attendance/scan`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getEventAttendance: (eventId: number, status?: string) => {
    const q = status ? `?status=${status}` : '';
    return request<any[]>(`/events/${eventId}/attendance${q}`);
  },
  correctAttendance: (attendanceId: number, data: { new_status: string; reason: string }) =>
    request<any>(`/attendance/${attendanceId}/correction`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Students
  getStudents: (params?: { search?: string; department?: string; year?: string; page?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.search) q.append('search', params.search);
    if (params?.department) q.append('department', params.department);
    if (params?.year) q.append('year', params.year);
    if (params?.page) q.append('page', params.page.toString());
    if (params?.limit) q.append('limit', params.limit.toString());
    return request<any>(`/students?${q.toString()}`);
  },
  getStudent: (id: number) => request<any>(`/students/${id}`),
  createStudent: (data: any) =>
    request<any>('/students', { method: 'POST', body: JSON.stringify(data) }),
  updateStudent: (id: number, data: any) =>
    request<any>(`/students/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  getDepartments: () => request<string[]>('/students/departments'),
  importStudentsCsv: async (file: File) => {
    const token = getToken();
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/students/import`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new ApiError(res.status, err.detail || 'Import failed');
    }
    return res.json();
  },

  // Reports
  getEventReport: (eventId: number) => request<any>(`/reports/event/${eventId}`),
  getStudentReport: (studentId: number) => request<any>(`/reports/student/${studentId}`),
  getSocietyReport: () => request<any>('/reports/society'),
  downloadEventCsv: async (eventId: number, filename = 'attendance.csv') => {
    const token = getToken();
    const res = await fetch(`${API_BASE}/reports/event/${eventId}/export/csv`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Failed to download CSV');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },

  // Audit
  getAuditLogs: (params?: { event_id?: number; student_id?: number; action?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.event_id) q.append('event_id', params.event_id.toString());
    if (params?.student_id) q.append('student_id', params.student_id.toString());
    if (params?.action) q.append('action', params.action);
    if (params?.limit) q.append('limit', params.limit.toString());
    return request<any[]>(`/audit?${q.toString()}`);
  },
  verifyAuditChain: () => request<any>('/audit/verify'),
};
