// src/data/mockData.ts
// One fixed Service Area — no separate Waiting Zone / Service Zone.
import type { CameraOption, StudentSummary, VisitRecord } from "./types";

export const CAMERAS: CameraOption[] = [
  { id: "cam01", label: "Camera 01 — Main Service Area", fps: 20, status: "Connected" },
  { id: "cam04", label: "Camera 04 — Corridor B", fps: 0, status: "Offline" },
];

export const DEPARTMENTS = ["CNTT", "ĐTVT", "KTMT", "HTTT"];

export const VISIT_RECORDS: VisitRecord[] = [
  {
    id: "ev001", studentId: "SV-2401", studentName: "Nguyễn Minh Khoa", className: "CNTT",
    status: "Served", cameraId: "cam01",
    enteredAt: "2026-09-04T09:14:00+07:00", servedAt: "2026-09-04T09:15:28+07:00", exitedAt: "2026-09-04T09:17:22+07:00",
    durationSeconds: 202, waitSeconds: 88,
  },
  {
    id: "ev002", studentId: "SV-1987", studentName: "Trần Thị Lan", className: "ĐTVT",
    status: "Waiting", cameraId: "cam01",
    enteredAt: "2026-09-04T09:31:00+07:00",
    durationSeconds: 490, waitSeconds: 490,
  },
  {
    id: "ev003", studentId: "SV-2203", studentName: "Lê Quốc Huy", className: "CNTT",
    status: "Unattended", cameraId: "cam01",
    enteredAt: "2026-09-04T10:02:00+07:00", exitedAt: "2026-09-04T10:14:45+07:00",
    durationSeconds: 765, waitSeconds: 765,
  },
  {
    id: "ev004", studentId: "SV-1755", studentName: "Phạm Thu Hà", className: "KTMT",
    status: "Served", cameraId: "cam01",
    enteredAt: "2026-09-04T10:18:00+07:00", servedAt: "2026-09-04T10:18:45+07:00", exitedAt: "2026-09-04T10:23:01+07:00",
    durationSeconds: 301, waitSeconds: 45,
  },
  {
    id: "ev005", studentId: "SV-2098", studentName: "Võ Duy Anh", className: "CNTT",
    status: "Waiting", cameraId: "cam01",
    enteredAt: "2026-09-04T10:45:00+07:00",
    durationSeconds: 153, waitSeconds: 153,
  },
  {
    id: "ev006", studentId: "SV-1643", studentName: "Đặng Ngọc Bích", className: "HTTT",
    status: "Served", cameraId: "cam01",
    enteredAt: "2026-09-04T11:03:00+07:00", servedAt: "2026-09-04T11:04:00+07:00", exitedAt: "2026-09-04T11:07:17+07:00",
    durationSeconds: 257, waitSeconds: 60,
  },
  {
    id: "ev007", studentId: "SV-2319", studentName: "Hoàng Văn Tuấn", className: "CNTT",
    status: "Unattended", cameraId: "cam01",
    enteredAt: "2026-09-04T11:22:00+07:00", exitedAt: "2026-09-04T11:31:58+07:00",
    durationSeconds: 598, waitSeconds: 598,
  },
  {
    id: "ev008", studentId: "SV-1502", studentName: "Bùi Thị Thanh", className: "ĐTVT",
    status: "Served", cameraId: "cam01",
    enteredAt: "2026-09-04T11:47:00+07:00", servedAt: "2026-09-04T11:48:10+07:00", exitedAt: "2026-09-04T11:53:30+07:00",
    durationSeconds: 390, waitSeconds: 70,
  },
  {
    id: "ev009", studentId: "SV-2401", studentName: "Nguyễn Minh Khoa", className: "CNTT",
    status: "Waiting", cameraId: "cam01",
    enteredAt: "2026-08-20T14:32:00+07:00",
    durationSeconds: 311, waitSeconds: 311,
  },
  {
    id: "ev010", studentId: "SV-2401", studentName: "Nguyễn Minh Khoa", className: "CNTT",
    status: "Served", cameraId: "cam01",
    enteredAt: "2026-08-18T10:05:00+07:00", servedAt: "2026-08-18T10:06:00+07:00", exitedAt: "2026-08-18T10:07:48+07:00",
    durationSeconds: 168, waitSeconds: 60,
  },
];

export const STUDENT_DIRECTORY: StudentSummary[] = [
  {
    studentId: "SV-2401", name: "Nguyễn Minh Khoa", className: "CNTT",
    totalVisits: 31, servedCount: 24, avgWaitSecs: 92,
    lastSeen: "2026-09-04T09:17:22+07:00", lastCameraId: "cam01",
    currentlyInArea: false,
  },
  {
    studentId: "SV-1987", name: "Trần Thị Lan", className: "ĐTVT",
    totalVisits: 12, servedCount: 8, avgWaitSecs: 210,
    lastSeen: "2026-09-04T09:31:00+07:00", lastCameraId: "cam01",
    currentlyInArea: true, currentStatus: "Waiting", currentWaitSeconds: 490,
  },
  {
    studentId: "SV-2203", name: "Lê Quốc Huy", className: "CNTT",
    totalVisits: 6, servedCount: 3, avgWaitSecs: 340,
    lastSeen: "2026-09-04T10:14:45+07:00", lastCameraId: "cam01",
    currentlyInArea: false,
  },
  {
    studentId: "SV-1755", name: "Phạm Thu Hà", className: "KTMT",
    totalVisits: 19, servedCount: 18, avgWaitSecs: 55,
    lastSeen: "2026-09-04T10:23:01+07:00", lastCameraId: "cam01",
    currentlyInArea: false,
  },
  {
    studentId: "SV-2098", name: "Võ Duy Anh", className: "CNTT",
    totalVisits: 4, servedCount: 2, avgWaitSecs: 140,
    lastSeen: "2026-09-04T10:45:00+07:00", lastCameraId: "cam01",
    currentlyInArea: true, currentStatus: "Waiting", currentWaitSeconds: 153,
  },
  {
    studentId: "SV-1643", name: "Đặng Ngọc Bích", className: "HTTT",
    totalVisits: 27, servedCount: 25, avgWaitSecs: 62,
    lastSeen: "2026-09-04T11:07:17+07:00", lastCameraId: "cam01",
    currentlyInArea: false,
  },
  {
    studentId: "SV-2319", name: "Hoàng Văn Tuấn", className: "CNTT",
    totalVisits: 9, servedCount: 4, avgWaitSecs: 402,
    lastSeen: "2026-09-04T11:31:58+07:00", lastCameraId: "cam01",
    currentlyInArea: false,
  },
  {
    studentId: "SV-1502", name: "Bùi Thị Thanh", className: "ĐTVT",
    totalVisits: 15, servedCount: 14, avgWaitSecs: 71,
    lastSeen: "2026-09-04T11:53:30+07:00", lastCameraId: "cam01",
    currentlyInArea: false,
  },
];
