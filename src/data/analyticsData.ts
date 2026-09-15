// src/data/analyticsData.ts
export const ANALYTICS_HOURLY: { hour: string; visits: number }[] = [
  { hour: "07h", visits: 2 }, { hour: "08h", visits: 5 }, { hour: "09h", visits: 9 },
  { hour: "10h", visits: 11 }, { hour: "11h", visits: 8 }, { hour: "12h", visits: 3 },
  { hour: "13h", visits: 4 }, { hour: "14h", visits: 7 }, { hour: "15h", visits: 6 },
  { hour: "16h", visits: 4 }, { hour: "17h", visits: 2 },
];

export const ANALYTICS_WEEKLY: { day: string; visits: number }[] = [
  { day: "T2", visits: 38 }, { day: "T3", visits: 44 }, { day: "T4", visits: 41 },
  { day: "T5", visits: 47 }, { day: "T6", visits: 52 }, { day: "T7", visits: 21 },
  { day: "CN", visits: 9 },
];

export const ANALYTICS_STATUS: { status: "Served" | "Waiting" | "Unattended"; count: number }[] = [
  { status: "Served", count: 31 },
  { status: "Waiting", count: 9 },
  { status: "Unattended", count: 7 },
];

export const PEAK_HOURS_GRID: number[][] = [
  [1, 2, 4, 6, 5, 2, 1, 3, 4, 2, 1],
  [1, 3, 5, 7, 6, 2, 2, 4, 5, 3, 1],
  [0, 2, 4, 6, 5, 1, 1, 3, 4, 2, 1],
  [2, 4, 6, 8, 7, 3, 3, 5, 6, 3, 2],
  [2, 5, 7, 9, 8, 3, 3, 6, 7, 4, 2],
  [0, 1, 2, 3, 2, 1, 0, 1, 2, 1, 0],
  [0, 0, 1, 1, 1, 0, 0, 0, 1, 0, 0],
];

export const PEAK_HOURS_LABELS = {
  days: ["T2", "T3", "T4", "T5", "T6", "T7", "CN"],
  hours: ["07h", "08h", "09h", "10h", "11h", "12h", "13h", "14h", "15h", "16h", "17h"],
};
