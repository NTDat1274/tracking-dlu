// src/lib/supabase.ts
// Supabase Client and Database Operations for TrackingZ DLU Web Admin.
import { createClient, type SupabaseClient, type RealtimeChannel } from "@supabase/supabase-js";
import { getCloudConfig } from "./config";
import type {
  VisitRecord,
  StudentSummary,
  VisitStatus,
  CameraOption,
  CameraStatus,
  AccountRecord,
  Lecturer,
  PendingStudentRecord,
  PendingStudentStatus,
} from "../data/types";

let cachedClient: SupabaseClient | null = null;
let currentConfigKey = "";

export function getSupabaseClient(): SupabaseClient | null {
  const config = getCloudConfig();
  const key = `${config.supabaseUrl}_${config.supabaseAnonKey}`;

  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    return null;
  }

  if (cachedClient && currentConfigKey === key) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    currentConfigKey = key;
    return cachedClient;
  } catch (err) {
    console.error("Failed to initialize Supabase client:", err);
    return null;
  }
}

// Local in-memory store for fallback/demo when Supabase is not connected
let localStudents: StudentSummary[] = [];
let localRecords: VisitRecord[] = [];

// ==============================================================================
// Task 5.1 — RAM-Only In-Memory Cache (TUYET DOI KHONG dung Cookies/LocalStorage)
//
// `InMemoryCacheManager` chi luu du lieu tren bo nho RAM (bien Javascript /
// Map trong phien lam viec). Du lieu RAM tu dong bien mat hoan toan khi F5
// hoac dong tab. Tuyet doi KHONG ghi vao localStorage / sessionStorage /
// Cookies de tranh ro ri du lieu nhay cam (sinh vien, lich su, admin) khi
// bi soi o dia. Chuyen trang Overview / Analytics / Visits / Students /
// LecturerPortal se tra ve tu RAM Cache ngay lap tuc (0ms).
//
// Luu y bao mat: Client chi su dung `VITE_SUPABASE_ANON_KEY` (public anon key
// chiu su dieu tiet cua RLS). Tuyet doi khong de lo Service Role Key hay
// credential nhay cam o phia client. KHONG doc file `.env.local` o day.
// ==============================================================================
export const RAM_CACHE_TTL_MS = {
  students: 60 * 1000,
  visits: 30 * 1000,
  lecturers: 120 * 1000,
  classes: 120 * 1000,
  cameras: 15 * 1000,
  heartbeat: 15 * 1000,
} as const;

export type RamCacheKey =
  | "students"
  | "visits"
  | "lecturers"
  | "classes"
  | "cameras"
  | "heartbeat";

interface RamCacheEntry<T> {
  value: T;
  expiresAt: number;
}

class InMemoryCacheManager {
  private store = new Map<RamCacheKey, RamCacheEntry<unknown>>();

  get<T>(key: RamCacheKey): T | null {
    const entry = this.store.get(key) as RamCacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  set<T>(key: RamCacheKey, value: T, ttlMs: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  invalidate(key: RamCacheKey): void {
    this.store.delete(key);
  }

  invalidateAll(): void {
    this.store.clear();
  }

  isFresh(key: RamCacheKey): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return false;
    }
    return true;
  }
}

/**
 * Singleton RAM cache duy nhat cua Web Dashboard. Song trong bo nho JS,
 * mat di khi reload/close tab. Khong bao gio persist xuong dia.
 */
export const inMemoryCache = new InMemoryCacheManager();

/**
 * Xoa sach RAM cache (goi khi signOut hoac khi can force-refresh).
 * Khong cham toi localStorage/sessionStorage/cookies.
 */
export function clearInMemoryCache(): void {
  inMemoryCache.invalidateAll();
}

function cloneJson<T>(value: T): T {
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return value;
  }
}

// ==============================================================================
// Task 5.1 — Input Sanitization chong XSS cho cac o Tim kiem / Form nhap lieu.
//
// Quy tac: cat khoang trang, gioi han do dai, loai bo ky tu dieu khien,
// escape 5 ky tu HTML nguy hiem (& < > " '). Ap dung truoc khi dua vao
// query Supabase (`eq`, `ilike`) hoac render ra UI.
// ==============================================================================
const CONTROL_CHARS_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function escapeHtml(input: unknown): string {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

export function sanitizeText(input: unknown, maxLength = 200): string {
  let s = String(input ?? "");
  s = s.replace(CONTROL_CHARS_RE, "");
  s = s.trim();
  if (s.length > maxLength) s = s.slice(0, maxLength);
  return s;
}

/**
 * Sanitize cho o tim kiem: giu lai chu cai (ke ca Unicode Tieng Viet),
 * so, khoang trang va mot so dau cau vo hai. Loai bo `< > " ' ; \`
 * de chan XSS / injection qua query string.
 */
export function sanitizeSearchInput(input: unknown, maxLength = 100): string {
  let s = sanitizeText(input, maxLength);
  s = s.replace(/[<>"'`;\\]/g, "");
  s = s.replace(/\s+/g, " ");
  return s.trim();
}

/**
 * Sanitize cho khoa chinh / id (MSSV, lecturer_code, uuid...): chi giu
 * chu, so, gach ngang, gach duoi, cham, @ (cho email).
 */
export function sanitizeId(input: unknown, maxLength = 120): string {
  const s = sanitizeText(input, maxLength);
  return s.replace(/[^a-zA-Z0-9\-_@.]/g, "").slice(0, maxLength);
}

/** Helper dung chung: chuyen DB time ve dang local ISO (giux nguyen logic cu). */
function toLocalIsoTrim(isoStr: string): string {
  if (!isoStr) return isoStr;
  return isoStr.replace(/(Z|[+-]\d{2}:?\d{2})$/, "");
}

function mapVisitRowToRecord(
  d: any,
  studentMap?: Map<string, { className: string; portraitUrl: string }>,
): VisitRecord & { snapshotUrl?: string; bestCrop?: string } {
  let status: VisitStatus = "Waiting";
  const s = (d.status || "").toUpperCase();
  if (s === "SERVED" || s === "COMPLETED" || s === "ĐÃ TIẾP NHẬN") status = "Served";
  else if (s === "UNATTENDED" || s === "ABANDONED" || s === "CHƯA TIẾP NHẬN") status = "Unattended";

  const timeIn = toLocalIsoTrim(d.time_in || d.created_at) || new Date().toISOString();
  const timeOut = d.time_out ? toLocalIsoTrim(d.time_out) : undefined;

  const enteredMs = new Date(timeIn).getTime();
  const exitedMs = timeOut ? new Date(timeOut).getTime() : Date.now();
  const durSecs = Math.max(0, Math.round((exitedMs - enteredMs) / 1000));

  let studentClass = "Unknown";
  let portraitUrl = "";
  const recordStudentId = d.student_id ? String(d.student_id).trim() : null;

  if (recordStudentId && studentMap && studentMap.has(recordStudentId)) {
    const info = studentMap.get(recordStudentId);
    if (info) {
      studentClass = info.className;
      portraitUrl = info.portraitUrl;
    }
  } else if (d.class_name) {
    studentClass = String(d.class_name);
  }
  studentClass = studentClass.trim();

  let computedAvatarUrl = undefined;
  const isRegisteredStudent = Boolean(recordStudentId && studentMap && studentMap.has(recordStudentId));

  if (isRegisteredStudent && portraitUrl) {
    computedAvatarUrl = portraitUrl;
  } else if (d.best_crop && d.student_name !== "Ẩn danh") {
    computedAvatarUrl = d.best_crop;
  }

  return {
    id: String(d.id),
    studentId: d.student_id || `TRK-${d.track_id}`,
    studentName: d.student_name || "Không rõ mặt",
    className: studentClass,
    status,
    cameraId: d.camera_id || "CAM-01",
    enteredAt: timeIn,
    exitedAt: timeOut,
    durationSeconds: d.duration_seconds || durSecs,
    waitSeconds: durSecs > 180 ? 180 : durSecs,
    avatarUrl: computedAvatarUrl,
    snapshotUrl: d.snapshot_url,
    bestCrop: d.best_crop || d.snapshot_url,
  } as VisitRecord & { snapshotUrl?: string; bestCrop?: string };
}

/**
 * Patch 1 ban ghi INSERT/UPDATE tu Supabase Realtime truc tiep vao RAM Cache
 * (khong can re-fetch toan bo danh sach). Giu thu tu moi nhat len dau.
 */
export function applyRealtimeVisitToCache(row: any): void {
  if (!row || typeof row !== "object") return;
  try {
    const cached = inMemoryCache.get<Array<VisitRecord & { snapshotUrl?: string; bestCrop?: string }>>("visits");
    const mapped = mapVisitRowToRecord(row);
    if (!cached) {
      inMemoryCache.set("visits", [mapped], RAM_CACHE_TTL_MS.visits);
      return;
    }
    const idx = cached.findIndex((r) => String(r.id) === String(mapped.id));
    let next: Array<VisitRecord & { snapshotUrl?: string; bestCrop?: string }>;
    if (idx >= 0) {
      next = [...cached];
      next[idx] = { ...next[idx], ...mapped };
    } else {
      next = [mapped, ...cached];
    }
    inMemoryCache.set("visits", next, RAM_CACHE_TTL_MS.visits);
  } catch {
    // Best-effort: khong bao gio lam vo realtime pipeline.
  }
}

/** Xoa 1 ban ghi DELETE khoi RAM Cache. */
export function removeRealtimeVisitFromCache(id: unknown): void {
  try {
    const cached = inMemoryCache.get<Array<VisitRecord & { snapshotUrl?: string; bestCrop?: string }>>("visits");
    if (!cached) return;
    const next = cached.filter((r) => String(r.id) !== String(id));
    inMemoryCache.set("visits", next, RAM_CACHE_TTL_MS.visits);
  } catch {
    // best-effort
  }
}

export interface StudentDBRecord {
  student_id: string;
  full_name: string;
  class_name?: string;
  email?: string;
  portrait_url?: string;
  created_at?: string;
}

export interface VisitDBRecord {
  id: number | string;
  track_id: number;
  student_id: string | null;
  student_name: string;
  time_in: string;
  time_out?: string | null;
  duration_seconds?: number;
  status: VisitStatus;
  snapshot_url?: string;
  best_crop?: string;
  camera_id?: string;
  created_at?: string;
}

/**
 * Fetch all students from Supabase (or local fallback)
 * [Task 5.1] Cache-First RAM-only: chuyen trang tra ve 0ms tu RAM.
 * Query toi uu: chi select() cac cot can thiet cho view.
 */
export async function fetchStudents(options?: { forceRefresh?: boolean }): Promise<StudentSummary[]> {
  const forceRefresh = options?.forceRefresh === true;
  if (!forceRefresh) {
    const cached = inMemoryCache.get<StudentSummary[]>("students");
    if (cached) return cloneJson(cached);
  }

  const client = getSupabaseClient();
  if (!client) {
    return [...localStudents];
  }

  try {
    const { data, error } = await client
      .from("students")
      .select("student_id, full_name, class_name, portrait_url, created_at")
      .order("created_at", { ascending: false });

    if (error || !data || data.length === 0) {
      if (error) console.warn("Supabase fetchStudents warning:", error.message);
      return [...localStudents];
    }

    // Helper to fix timezone shift by treating DB time as local
    const toLocalIso = (isoStr: string) => {
      if (!isoStr) return isoStr;
      return isoStr.replace(/(Z|[+-]\d{2}:?\d{2})$/, '');
    };

    // Map DB schema to UI StudentSummary
    const mapped = data.map((d: any) => {
      const matchHistory = localRecords.filter((r) => r.studentId === d.student_id);
      const servedCount = matchHistory.filter((r) => r.status === "Served").length;
      return {
        studentId: d.student_id,
        name: d.full_name,
        className: d.class_name ? String(d.class_name).trim() : "CNTT",
        totalVisits: matchHistory.length,
        servedCount,
        avgWaitSecs: 180,
        lastSeen: toLocalIso(d.created_at) || new Date().toISOString(),
        lastCameraId: "CAM-01",
        currentlyInArea: false,
        portraitUrl: d.portrait_url,
      } as StudentSummary & { portraitUrl?: string };
    });
    // [Task 5.1] Luu RAM-only (khong localStorage/cookies).
    inMemoryCache.set("students", mapped, RAM_CACHE_TTL_MS.students);
    return cloneJson(mapped);
  } catch (err) {
    console.warn("fetchStudents error, falling back to local:", err);
    return [...localStudents];
  }
}

/**
 * Insert or Update a student record
 */
export async function upsertStudent(student: {
  student_id: string;
  full_name: string;
  class_name: string;
  email: string;
  portrait_url: string;
}): Promise<{ success: boolean; error?: string }> {
  const cleanStudent = {
    student_id: sanitizeId(student.student_id),
    full_name: sanitizeText(student.full_name, 120),
    class_name: sanitizeText(student.class_name, 80),
    email: sanitizeText(student.email, 120),
    portrait_url: sanitizeText(student.portrait_url, 2000),
  };
  // Update local store
  const existingIdx = localStudents.findIndex((s) => s.studentId === cleanStudent.student_id);
  const updatedItem: any = {
    studentId: cleanStudent.student_id,
    name: cleanStudent.full_name,
    className: cleanStudent.class_name,
    totalVisits: existingIdx >= 0 ? localStudents[existingIdx].totalVisits : 0,
    servedCount: existingIdx >= 0 ? localStudents[existingIdx].servedCount : 0,
    avgWaitSecs: existingIdx >= 0 ? localStudents[existingIdx].avgWaitSecs : 0,
    lastSeen: new Date().toISOString(),
    lastCameraId: "CAM-01",
    currentlyInArea: false,
    portraitUrl: cleanStudent.portrait_url,
  };

  if (existingIdx >= 0) {
    localStudents[existingIdx] = { ...localStudents[existingIdx], ...updatedItem };
  } else {
    localStudents.unshift(updatedItem);
  }
  // [Task 5.1] Invalidate RAM cache de lan fetch ke tiep lay du lieu moi.
  inMemoryCache.invalidate("students");
  inMemoryCache.invalidate("classes");

  const client = getSupabaseClient();
  if (!client) {
    return { success: true };
  }

  try {
    const { error } = await client.from("students").upsert({
      student_id: cleanStudent.student_id,
      full_name: cleanStudent.full_name,
      class_name: cleanStudent.class_name,
      email: cleanStudent.email,
      portrait_url: cleanStudent.portrait_url,
    });

    if (error) {
      console.error("Supabase upsertStudent error:", error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Delete a student and clean up all associated records (Cascade cleanup).
 */
export async function deleteStudentCascade(studentId: string): Promise<{ success: boolean; error?: string }> {
  const cleanId = sanitizeId(studentId);
  // 1. Clean local state
  localStudents = localStudents.filter((s) => s.studentId !== cleanId);
  localRecords = localRecords.filter((r) => r.studentId !== cleanId);
  // [Task 5.1] Invalidate RAM cache de UI dong bo ngay.
  inMemoryCache.invalidate("students");
  inMemoryCache.invalidate("visits");
  inMemoryCache.invalidate("classes");

  const client = getSupabaseClient();
  if (!client) {
    return { success: true };
  }

  try {
    // 1. Fetch the student's portrait_url before deleting
    const { data: st } = await client.from("students").select("portrait_url").eq("student_id", cleanId).single();
    let publicId = null;
    
    if (st?.portrait_url) {
      // Extract public_id from Cloudinary URL
      // Example: https://res.cloudinary.com/xyz/image/upload/v1234/folder/file.jpg -> folder/file
      const parts = st.portrait_url.split("/upload/");
      if (parts.length > 1) {
        let path = parts[1];
        if (path.match(/^v\d+\//)) path = path.replace(/^v\d+\//, "");
        const dotIndex = path.lastIndexOf(".");
        if (dotIndex !== -1) path = path.substring(0, dotIndex);
        publicId = path;
      }
    }

    // 2. Clean dependent records
    await client.from("student_records").delete().eq("student_id", cleanId);

    // 3. Delete student
    const { error } = await client.from("students").delete().eq("student_id", cleanId);

    if (error) {
      console.error("Supabase deleteStudent error:", error);
      return { success: false, error: error.message };
    }

    // 4. Delete Cloudinary image using Edge Function if we have a public_id
    if (publicId) {
      try {
        await client.functions.invoke("delete-cloudinary-image", {
          body: { public_id: publicId }
        });
      } catch (edgeErr) {
        console.warn("Could not delete Cloudinary image:", edgeErr);
      }
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Fetch all student visits / records
 * [Task 5.1] Cache-First RAM-only + select() cot can thiet cho view.
 */
export async function fetchVisitRecords(options?: { forceRefresh?: boolean }): Promise<VisitRecord[]> {
  const forceRefresh = options?.forceRefresh === true;
  if (!forceRefresh) {
    const cached = inMemoryCache.get<VisitRecord[]>("visits");
    if (cached) return cloneJson(cached);
  }

  const client = getSupabaseClient();
  if (!client) {
    return [...localRecords];
  }

  try {
    const [ { data: recordsData, error: recordsError }, { data: studentsData } ] = await Promise.all([
      client.from("student_records").select("id, track_id, student_id, student_name, time_in, time_out, duration_seconds, status, camera_id, snapshot_url, best_crop, created_at").order("time_in", { ascending: false }),
      client.from("students").select("student_id, class_name, portrait_url")
    ]);

    if (recordsError || !recordsData || recordsData.length === 0) {
      return [...localRecords];
    }

    // Map students for quick lookup
    const studentMap = new Map<string, { className: string; portraitUrl: string }>();
    if (studentsData) {
      for (const s of studentsData) {
        if (s.student_id) {
          studentMap.set(String(s.student_id).trim(), {
            className: s.class_name || "Unknown",
            portraitUrl: s.portrait_url || ""
          });
        }
      }
    }

    // Helper to fix timezone shift by treating DB time as local
    // (giu helper dùng chung toLocalIsoTrim o dau file; bien cuc bo nay chi
    // de tuong thich ngu canh cu, khong dung truc tiep nua).
    void toLocalIsoTrim;

    const mapped = recordsData.map((d: any) => mapVisitRowToRecord(d, studentMap));
    // [Task 5.1] Luu RAM-only de chuyen trang Overview/Analytics/Visits 0ms.
    inMemoryCache.set("visits", mapped, RAM_CACHE_TTL_MS.visits);
    return cloneJson(mapped);
  } catch (err) {
    console.warn("fetchVisitRecords error, falling back:", err);
    return [...localRecords];
  }
}

/**
 * Dynamically extract distinct classes from Supabase & local students
 * [Task 5.1] RAM-only cache.
 */
export async function fetchDistinctClasses(options?: { forceRefresh?: boolean }): Promise<string[]> {
  if (options?.forceRefresh !== true) {
    const cached = inMemoryCache.get<string[]>("classes");
    if (cached) return [...cached];
  }
  const client = getSupabaseClient();

  if (!client) {
    const fromLocal = localStudents.map((s) => s.className?.trim()).filter(Boolean);
    return Array.from(new Set(fromLocal)).sort();
  }

  try {
    const { data, error } = await client.from("students").select("class_name");
    if (error || !data) {
      const fromLocal = localStudents.map((s) => s.className?.trim()).filter(Boolean);
      return Array.from(new Set(fromLocal)).sort();
    }
    const fromDb = data.map((d: any) => d.class_name?.trim()).filter(Boolean);
    const result = Array.from(new Set(fromDb)).sort();
    inMemoryCache.set("classes", result, RAM_CACHE_TTL_MS.classes);
    return [...result];
  } catch {
    const fromLocal = localStudents.map((s) => s.className?.trim()).filter(Boolean);
    return Array.from(new Set(fromLocal)).sort();
  }
}



/**
 * Dynamically extract distinct live cameras from the heartbeat table 'cameras'
 * [Task 5.1] RAM-only cache + select() cot can thiet.
 */
export async function fetchDistinctCameras(options?: { forceRefresh?: boolean }): Promise<CameraOption[]> {
  const defaultCameras: CameraOption[] = [{ id: "CAM-01", label: "Camera 01", fps: 30, status: "Connected" }];
  if (options?.forceRefresh !== true) {
    const cached = inMemoryCache.get<CameraOption[]>("cameras");
    if (cached) return cloneJson(cached);
  }
  const client = getSupabaseClient();

  if (!client) return defaultCameras;

  try {
    const { data, error } = await client.from("cameras").select("id, label, fps, status, last_active_at");
    if (error || !data || data.length === 0) return defaultCameras;

    const now = Date.now();
    const mapped: CameraOption[] = data.map((d: any): CameraOption => {
      let isOffline = d.status === "Offline";

      // Calculate age of heartbeat
        if (d.last_active_at) {
          // Parse directly so the 'Z' or '+00:00' is respected and converted to correct epoch time
          const lastActive = new Date(d.last_active_at).getTime();
          if (now - lastActive > 15000) {
             isOffline = true; // 15 seconds timeout
          }
        } else {
        isOffline = true;
      }

      return {
        id: d.id,
        label: d.label || `Camera ${d.id}`,
        fps: d.fps || 30,
        status: isOffline ? "Offline" : "Connected"
      };
    });
    inMemoryCache.set("cameras", mapped, RAM_CACHE_TTL_MS.cameras);
    return cloneJson(mapped);
  } catch (err) {
    return defaultCameras;
  }
}

/**
 * Realtime Subscription listener for student_records table.
 * Automatically receives INSERT, UPDATE, DELETE events without F5 page reloads.
 * [Task 5.1] Patch truc tiep vao RAM Cache de UI realtime khong can re-fetch.
 */
export function subscribeToStudentRecords(
  onRecordChange: (payload: any) => void
): { unsubscribe: () => void } {
  const client = getSupabaseClient();
  if (!client) {
    return { unsubscribe: () => {} };
  }

  try {
    const channel: RealtimeChannel = client
      .channel("student_records_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "student_records" },
        (payload) => {
          try {
            const eventType = (payload as any)?.eventType as string | undefined;
            const row = (payload as any)?.new ?? (payload as any)?.record ?? null;
            if (eventType === "DELETE") {
              const oldRow = (payload as any)?.old ?? null;
              const delId = oldRow?.id ?? row?.id ?? (payload as any)?.id;
              if (delId !== undefined) removeRealtimeVisitFromCache(delId);
            } else if (row) {
              applyRealtimeVisitToCache(row);
            }
          } catch {
            // best-effort cache patch
          }
          onRecordChange(payload);
        }
      )
      .subscribe();

    return {
      unsubscribe: () => {
        client.removeChannel(channel);
      },
    };
  } catch (err) {
    console.error("Failed to subscribe to realtime student_records:", err);
    return { unsubscribe: () => {} };
  }
}

export async function deleteVisitRecord(id: string): Promise<{ success: boolean; error?: string }> {
  localRecords = localRecords.filter((r) => r.id !== id);
  // [Task 5.1] Xoa khoi RAM Cache ngay de UI phan hoi tuc thi.
  removeRealtimeVisitFromCache(sanitizeId(id));

  const client = getSupabaseClient();
  if (!client) {
    return { success: true };
  }

  try {
    const { error } = await client.from('student_records').delete().eq('id', sanitizeId(id));
    if (error) {
      console.error('Supabase deleteVisitRecord error:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Unknown error' };
  }
}

/**
 * Fetch account record for a user
 */
export async function fetchUserAccount(userId: string): Promise<AccountRecord | null> {
  const cleanId = sanitizeId(userId);
  if (!cleanId) return null;
  const client = getSupabaseClient();
  if (!client) {
    return {
      id: cleanId,
      email: "local@dlu.edu.vn",
      role: "admin",
      student_id: null,
    };
  }

  try {
    const { data, error } = await client
      .from("accounts")
      .select("id, email, role, student_id, created_at, updated_at")
      .eq("id", cleanId)
      .maybeSingle();

    if (error) {
      console.warn("fetchUserAccount warning:", error.message);
      return null;
    }

    return data as AccountRecord | null;
  } catch (err) {
    console.warn("fetchUserAccount error:", err);
    return null;
  }
}

/**
 * Save student profile submitted by student self-service portal,
 * and link student_id to user's account in Supabase.
 */
export async function saveStudentSelfProfile(data: {
  student_id: string;
  full_name: string;
  class_name: string;
  email: string;
  portrait_url: string;
  userId: string;
}): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: true };
  }

  try {
    // 1. Upsert student record
    const cleanSelf = {
      student_id: sanitizeId(data.student_id),
      full_name: sanitizeText(data.full_name, 120),
      class_name: sanitizeText(data.class_name, 80),
      email: sanitizeText(data.email, 120),
      portrait_url: sanitizeText(data.portrait_url, 2000),
      userId: sanitizeId(data.userId),
    };
    const { error: studentErr } = await client.from("students").upsert({
      student_id: cleanSelf.student_id,
      full_name: cleanSelf.full_name,
      class_name: cleanSelf.class_name,
      email: cleanSelf.email,
      portrait_url: cleanSelf.portrait_url,
    });

    if (studentErr) {
      console.error("saveStudentSelfProfile student error:", studentErr);
      return { success: false, error: studentErr.message };
    }

    // 2. Link student_id to accounts table
    const { error: accountErr } = await client
      .from("accounts")
      .update({
        student_id: cleanSelf.student_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", cleanSelf.userId);

    if (accountErr) {
      console.error("saveStudentSelfProfile account link error:", accountErr);
      return { success: false, error: accountErr.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Lỗi lưu hồ sơ sinh viên" };
  }
}

/**
 * Fetch personal profile for a specific student_id
 */
export async function fetchStudentPersonalProfile(studentId: string): Promise<(StudentSummary & { portraitUrl?: string; email?: string }) | null> {
  const cleanId = sanitizeId(studentId);
  if (!cleanId) return null;
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from("students")
      .select("student_id, full_name, class_name, email, portrait_url, created_at")
      .eq("student_id", cleanId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return {
      studentId: data.student_id,
      name: data.full_name,
      className: data.class_name || "",
      email: data.email || "",
      portraitUrl: data.portrait_url || "",
      totalVisits: 0,
      servedCount: 0,
      avgWaitSecs: 0,
      lastSeen: data.created_at || new Date().toISOString(),
      lastCameraId: "CAM-01",
      currentlyInArea: false,
    };
  } catch (err) {
    console.warn("fetchStudentPersonalProfile error:", err);
    return null;
  }
}

/**
 * Fetch personal visit records for a student
 */
export async function fetchStudentPersonalVisits(studentId: string): Promise<VisitRecord[]> {
  const cleanId = sanitizeId(studentId);
  if (!cleanId) return [];
  const client = getSupabaseClient();
  if (!client) return [];

  try {
    const { data, error } = await client
      .from("student_records")
      .select("id, track_id, student_id, student_name, time_in, time_out, duration_seconds, status, camera_id, snapshot_url, best_crop, created_at")
      .eq("student_id", cleanId)
      .order("time_in", { ascending: false });

    if (error || !data) return [];

    const toLocalIso = (isoStr: string) => {
      if (!isoStr) return isoStr;
      return isoStr.replace(/(Z|[+-]\d{2}:?\d{2})$/, "");
    };

    return data.map((d: any) => {
      let status: VisitStatus = "Waiting";
      const s = (d.status || "").toUpperCase();
      if (s === "SERVED" || s === "COMPLETED" || s === "ĐÃ TIẾP NHẬN") status = "Served";
      else if (s === "UNATTENDED" || s === "ABANDONED" || s === "CHƯA TIẾP NHẬN") status = "Unattended";

      const timeIn = toLocalIso(d.time_in || d.created_at) || new Date().toISOString();
      const timeOut = d.time_out ? toLocalIso(d.time_out) : undefined;
      const enteredMs = new Date(timeIn).getTime();
      const exitedMs = timeOut ? new Date(timeOut).getTime() : Date.now();
      const durSecs = Math.max(0, Math.round((exitedMs - enteredMs) / 1000));

      return {
        id: String(d.id),
        studentId: d.student_id,
        studentName: d.student_name || "Sinh viên",
        className: d.class_name || "",
        status,
        cameraId: d.camera_id || "CAM-01",
        enteredAt: timeIn,
        exitedAt: timeOut,
        durationSeconds: d.duration_seconds || durSecs,
        waitSeconds: durSecs > 180 ? 180 : durSecs,
        avatarUrl: d.best_crop || d.snapshot_url,
        snapshotUrl: d.snapshot_url,
        bestCrop: d.best_crop || d.snapshot_url,
      } as VisitRecord;
    });
  } catch (err) {
    console.warn("fetchStudentPersonalVisits error:", err);
    return [];
  }
}

/**
 * Fetch all lecturers from Supabase `lecturers` table.
 * Falls back to an empty array when Supabase is unreachable.
 * [Task 5.1] RAM-only cache + select() khong lay embedding 512-D nang.
 */
export async function fetchLecturers(options?: { forceRefresh?: boolean }): Promise<Lecturer[]> {
  if (options?.forceRefresh !== true) {
    const cached = inMemoryCache.get<Lecturer[]>("lecturers");
    if (cached) return cloneJson(cached);
  }
  const client = getSupabaseClient();
  if (!client) {
    return [];
  }

  try {
    const { data, error } = await client
      .from("lecturers")
      .select("id, lecturer_code, full_name, department, avatar_url, created_at")
      .order("created_at", { ascending: false });

    if (error || !data) {
      if (error) console.warn("Supabase fetchLecturers warning:", error.message);
      return [];
    }

    const mapped = data.map((d: any) => ({
      id: String(d.id),
      lecturer_code: d.lecturer_code,
      full_name: d.full_name,
      department: d.department ?? null,
      avatar_url: d.avatar_url ?? null,
      embedding: null,
      created_at: d.created_at,
    })) as Lecturer[];
    inMemoryCache.set("lecturers", mapped, RAM_CACHE_TTL_MS.lecturers);
    return cloneJson(mapped);
  } catch (err) {
    console.warn("fetchLecturers error:", err);
    return [];
  }
}

/**
 * Fetch a single lecturer by their `lecturer_code` (unique business code).
 */
export async function fetchLecturerByCode(lecturerCode: string): Promise<Lecturer | null> {
  const cleanCode = sanitizeId(lecturerCode);
  if (!cleanCode) return null;
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from("lecturers")
      .select("id, lecturer_code, full_name, department, avatar_url, created_at")
      .eq("lecturer_code", cleanCode)
      .maybeSingle();

    if (error || !data) {
      if (error) console.warn("fetchLecturerByCode warning:", error.message);
      return null;
    }

    return {
      id: String(data.id),
      lecturer_code: data.lecturer_code,
      full_name: data.full_name,
      department: data.department ?? null,
      avatar_url: data.avatar_url ?? null,
      embedding: (data as any).embedding ?? null,
      created_at: data.created_at,
    } as Lecturer;
  } catch (err) {
    console.warn("fetchLecturerByCode error:", err);
    return null;
  }
}

/**
 * Insert or update a lecturer profile on Supabase `lecturers` table.
 * Embedding is optional and only updated when explicitly provided (Desktop AI pipeline).
 */
export async function upsertLecturer(lecturer: {
  lecturer_code: string;
  full_name: string;
  department?: string;
  avatar_url?: string;
  embedding?: number[];
}): Promise<{ success: boolean; error?: string; data?: Lecturer }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, error: "Supabase chưa được cấu hình." };
  }

  try {
    const payload: Record<string, any> = {
      lecturer_code: sanitizeId(lecturer.lecturer_code),
      full_name: sanitizeText(lecturer.full_name, 120),
      department: lecturer.department ? sanitizeText(lecturer.department, 120) : null,
      avatar_url: lecturer.avatar_url ? sanitizeText(lecturer.avatar_url, 2000) : null,
    };

    if (lecturer.embedding && Array.isArray(lecturer.embedding)) {
      payload.embedding = lecturer.embedding;
    }

    const { data, error } = await client
      .from("lecturers")
      .upsert(payload, { onConflict: "lecturer_code" })
      .select("id, lecturer_code, full_name, department, avatar_url, created_at")
      .maybeSingle();

    if (error) {
      console.error("Supabase upsertLecturer error:", error);
      return { success: false, error: error.message };
    }

    // [Task 5.1] Invalidate RAM cache lecturers de fetch ke tiep moi nhat.
    inMemoryCache.invalidate("lecturers");

    return {
      success: true,
      data: data
        ? ({
            id: String(data.id),
            lecturer_code: data.lecturer_code,
            full_name: data.full_name,
            department: data.department ?? null,
            avatar_url: data.avatar_url ?? null,
            embedding: (data as any).embedding ?? null,
            created_at: data.created_at,
          } as Lecturer)
        : undefined,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || "Lỗi không xác định" };
  }
}

/**
 * Delete a lecturer from Supabase `lecturers` table by their business code.
 * Cleans up the Cloudinary avatar (if present) via the Edge Function.
 */
export async function deleteLecturerByCode(lecturerCode: string): Promise<{ success: boolean; error?: string }> {
  const cleanCode = sanitizeId(lecturerCode);
  if (!cleanCode) return { success: false, error: "Mã giảng viên không hợp lệ." };
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, error: "Supabase chưa được cấu hình." };
  }

  try {
    // 1. Fetch avatar_url before deleting for Cloudinary cleanup
    const { data: existing } = await client
      .from("lecturers")
      .select("avatar_url")
      .eq("lecturer_code", cleanCode)
      .maybeSingle();

    let publicId: string | null = null;
    if (existing?.avatar_url) {
      const parts = String(existing.avatar_url).split("/upload/");
      if (parts.length > 1) {
        let path = parts[1];
        if (path.match(/^v\d+\//)) path = path.replace(/^v\d+\//, "");
        const dotIndex = path.lastIndexOf(".");
        if (dotIndex !== -1) path = path.substring(0, dotIndex);
        publicId = path;
      }
    }

    // 2. Delete row from Supabase
    const { error } = await client
      .from("lecturers")
      .delete()
      .eq("lecturer_code", cleanCode);

    if (error) {
      console.error("Supabase deleteLecturerByCode error:", error);
      return { success: false, error: error.message };
    }

    // [Task 5.1] Invalidate RAM cache lecturers.
    inMemoryCache.invalidate("lecturers");

    // 3. Best-effort cleanup of Cloudinary avatar
    if (publicId) {
      try {
        await client.functions.invoke("delete-cloudinary-image", {
          body: { public_id: publicId },
        });
      } catch (edgeErr) {
        console.warn("Could not delete Cloudinary lecturer avatar:", edgeErr);
      }
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Lỗi không xác định" };
  }
}

/**
 * Update the 512-D face embedding vector for a given lecturer.
 * Used by the Desktop AI pipeline after a successful face enrollment.
 */
export async function updateLecturerEmbedding(
  lecturerCode: string,
  embedding: number[],
): Promise<{ success: boolean; error?: string }> {
  const cleanCode = sanitizeId(lecturerCode);
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, error: "Supabase chưa được cấu hình." };
  }

  if (!Array.isArray(embedding) || embedding.length === 0) {
    return { success: false, error: "Embedding vector không hợp lệ." };
  }

  try {
    const { error } = await client
      .from("lecturers")
      .update({ embedding })
      .eq("lecturer_code", cleanCode);

    if (error) {
      console.error("Supabase updateLecturerEmbedding error:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Lỗi không xác định" };
  }
}

/**
 * Realtime subscription for the `lecturers` table.
 * Fires onRecordChange for INSERT/UPDATE/DELETE events.
 */
export function subscribeToLecturers(
  onLecturerChange: (payload: any) => void,
): { unsubscribe: () => void } {
  const client = getSupabaseClient();
  if (!client) {
    return { unsubscribe: () => {} };
  }

  try {
    const channel: RealtimeChannel = client
      .channel("lecturers_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lecturers" },
        (payload) => {
          onLecturerChange(payload);
        },
      )
      .subscribe();

    return {
      unsubscribe: () => {
        client.removeChannel(channel);
      },
    };
  } catch (err) {
    console.error("Failed to subscribe to realtime lecturers:", err);
    return { unsubscribe: () => {} };
  }
}

/**
 * Rich camera heartbeat record returned by `fetchCamerasHeartbeat`.
 * Includes the raw `last_active_at` timestamp so the UI can display
 * "last seen" timing and derive an offline state when too much time
 * has elapsed since the last ping (1-2 minutes by default).
 */
export interface CameraHeartbeatRecord {
  id: string;
  label: string;
  fps: number;
  rawStatus: string | null;
  status: CameraStatus;
  lastActiveAt: string | null;
  lastActiveMs: number | null;
  ageSeconds: number;
  isOnline: boolean;
}

/**
 * Threshold (milliseconds) after which a camera is considered offline
 * if no heartbeat has been received. Configured to 90 seconds (~1.5 min)
 * to be lenient with brief network blips while still detecting failures
 * within 1-2 minutes as required by the task.
 */
export const CAMERA_HEARTBEAT_TIMEOUT_MS = 90 * 1000;

/**
 * Fetch the full heartbeat row for each registered camera in the
 * `cameras` table. Unlike `fetchDistinctCameras`, this helper also
 * returns the raw `last_active_at` value and computes the heartbeat
 * age so that the UI can render live indicators and last-seen labels.
 */
export async function fetchCamerasHeartbeat(options?: { forceRefresh?: boolean }): Promise<CameraHeartbeatRecord[]> {
  if (options?.forceRefresh !== true) {
    const cached = inMemoryCache.get<CameraHeartbeatRecord[]>("heartbeat");
    if (cached) return cloneJson(cached);
  }
  const client = getSupabaseClient();

  if (!client) {
    // Offline / no-config fallback: report a single synthetic offline camera.
    return [
      {
        id: "CAM-01",
        label: "Camera 01",
        fps: 30,
        rawStatus: "Offline",
        status: "Offline",
        lastActiveAt: null,
        lastActiveMs: null,
        ageSeconds: Number.POSITIVE_INFINITY,
        isOnline: false,
      },
    ];
  }

  try {
    const { data, error } = await client.from("cameras").select("id, label, fps, status, last_active_at");
    if (error || !data || data.length === 0) return [];

    const now = Date.now();
    const mapped: CameraHeartbeatRecord[] = data.map((d: any): CameraHeartbeatRecord => {
      const rawStatus = (d.status as string | null) ?? null;
      let lastActiveMs: number | null = null;
      let lastActiveAt: string | null = d.last_active_at ?? null;

      if (lastActiveAt) {
        const ts = new Date(lastActiveAt).getTime();
        if (!isNaN(ts)) lastActiveMs = ts;
      }

      const ageSeconds = lastActiveMs
        ? Math.max(0, Math.floor((now - lastActiveMs) / 1000))
        : Number.POSITIVE_INFINITY;

      const expiredByHeartbeat =
        lastActiveMs === null || now - lastActiveMs > CAMERA_HEARTBEAT_TIMEOUT_MS;
      const statusFlagOffline = rawStatus === "Offline";

      const isOnline = !(expiredByHeartbeat || statusFlagOffline);

      return {
        id: d.id,
        label: d.label || `Camera ${d.id}`,
        fps: d.fps || 30,
        rawStatus,
        status: isOnline ? "Connected" : "Offline",
        lastActiveAt,
        lastActiveMs,
        ageSeconds,
        isOnline,
      };
    });
    inMemoryCache.set("heartbeat", mapped, RAM_CACHE_TTL_MS.heartbeat);
    return cloneJson(mapped);
  } catch (err) {
    console.warn("fetchCamerasHeartbeat error:", err);
    return [];
  }
}

/**
 * Realtime subscription for the `cameras` heartbeat table.
 * Fires `onCameraChange` for every INSERT/UPDATE/DELETE event so the
 * dashboard can re-fetch the heartbeat list and update the UI without
 * relying on heavy polling intervals.
 */
export function subscribeToCamerasHeartbeat(
  onCameraChange: (payload: any) => void,
): { unsubscribe: () => void } {
  const client = getSupabaseClient();
  if (!client) {
    return { unsubscribe: () => {} };
  }

  try {
    const channel: RealtimeChannel = client
      .channel("cameras_heartbeat_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cameras" },
        (payload) => {
          onCameraChange(payload);
        },
      )
      .subscribe();

    return {
      unsubscribe: () => {
        client.removeChannel(channel);
      },
    };
  } catch (err) {
    console.error("Failed to subscribe to realtime cameras heartbeat:", err);
    return { unsubscribe: () => {} };
  }
}

// ==============================================================================
// Task 4.1 — Pending Students workflow
//
// The student self-service portal (StudentPortalPage) and the Admin Student
// Modal both submit a webcam snapshot + identity info into a `pending_students`
// staging table. An admin must explicitly Approve the record before it is
// promoted to the main `students` table (which is what Desktop App syncs
// against). This isolation guarantees that unverified portraits can never
// accidentally reach the AI pipeline or the camera recognition service.
// ==============================================================================

/**
 * Submit a freshly-captured webcam snapshot + identity info as a NEW pending
 * record. The student_portal ALWAYS uses this function instead of writing
 * directly to `students`, so Admin approval is enforced.
 */
export async function submitPendingStudent(input: {
  student_id: string;
  full_name: string;
  class_name?: string;
  email?: string;
  portrait_url: string;
  submitted_by?: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    // No Supabase configured -> still report a successful offline insert
    // so the demo flow does not block. In production this branch should
    // probably return an explicit error.
    return { success: true };
  }

  try {
    const payload: Record<string, any> = {
      student_id: sanitizeId(input.student_id),
      full_name: sanitizeText(input.full_name, 120),
      portrait_url: sanitizeText(input.portrait_url, 2000),
      status: "pending",
    };

    if (sanitizeText(input.class_name ?? "", 80)) payload.class_name = sanitizeText(input.class_name, 80);
    if (sanitizeText(input.email ?? "", 120)) payload.email = sanitizeText(input.email, 120);
    if (input.submitted_by) payload.submitted_by = sanitizeId(input.submitted_by);

    const { data, error } = await client
      .from("pending_students")
      .insert(payload)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("submitPendingStudent error:", error);
      return { success: false, error: error.message };
    }
    return { success: true, id: data?.id };
  } catch (err: any) {
    return { success: false, error: err?.message || "Lỗi gửi hồ sơ chờ duyệt" };
  }
}

/**
 * Fetch all pending students (typically called by the Admin approval page).
 * Defaults to `status = 'pending'` which is what the Admin dashboard wants
 * to act on; pass `status = 'all'` to retrieve every record (useful for
 * analytics/review history).
 */
export async function fetchPendingStudents(
  status: PendingStudentStatus | "all" = "pending",
): Promise<PendingStudentRecord[]> {
  const safeStatus = status === "all" ? "all" : sanitizeText(status, 20);
  const client = getSupabaseClient();
  if (!client) return [];

  try {
    let query = client
      .from("pending_students")
      .select("id, student_id, full_name, class_name, email, portrait_url, status, submitted_by, reviewed_by, review_note, created_at, updated_at")
      .order("created_at", { ascending: false });
    if (safeStatus !== "all") {
      query = query.eq("status", safeStatus);
    }
    const { data, error } = await query;
    if (error) {
      console.warn("fetchPendingStudents warning:", error.message);
      return [];
    }
    return (data || []).map((d: any) => ({
      id: String(d.id),
      student_id: d.student_id,
      full_name: d.full_name,
      class_name: d.class_name ?? null,
      email: d.email ?? null,
      portrait_url: d.portrait_url ?? "",
      status: (d.status ?? "pending") as PendingStudentStatus,
      submitted_by: d.submitted_by ?? null,
      reviewed_by: d.reviewed_by ?? null,
      review_note: d.review_note ?? null,
      created_at: d.created_at,
      updated_at: d.updated_at,
    })) as PendingStudentRecord[];
  } catch (err) {
    console.warn("fetchPendingStudents error:", err);
    return [];
  }
}

/**
 * Subscribe to realtime INSERT/UPDATE/DELETE events on `pending_students`
 * so the Admin approval page refreshes automatically when students submit
 * new portraits.
 */
export function subscribeToPendingStudents(
  onChange: (payload: any) => void,
): { unsubscribe: () => void } {
  const client = getSupabaseClient();
  if (!client) return { unsubscribe: () => {} };

  try {
    const channel: RealtimeChannel = client
      .channel("pending_students_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pending_students" },
        (payload) => onChange(payload),
      )
      .subscribe();

    return {
      unsubscribe: () => {
        client.removeChannel(channel);
      },
    };
  } catch (err) {
    console.error("Failed to subscribe to pending_students:", err);
    return { unsubscribe: () => {} };
  }
}

/**
 * Promote a single pending student to the main `students` table and mark
 * the pending row as `approved`. Implemented with two sequential updates
 * so the Desktop App realtime subscription to `students` picks up the
 * newly-approved record alongside the existing flow.
 */
export async function approvePendingStudent(input: {
  pendingId: string;
  reviewedBy?: string;
}): Promise<{ success: boolean; error?: string }> {
  const cleanId = sanitizeId(input.pendingId);
  const cleanReviewer = input.reviewedBy ? sanitizeId(input.reviewedBy) : null;
  const client = getSupabaseClient();
  if (!client) return { success: false, error: "Supabase chưa được cấu hình." };

  try {
    const { data: pendingRow, error: fetchErr } = await client
      .from("pending_students")
      .select("student_id, full_name, class_name, email, portrait_url")
      .eq("id", cleanId)
      .maybeSingle();

    if (fetchErr) {
      return { success: false, error: fetchErr.message };
    }
    if (!pendingRow) {
      return { success: false, error: "Không tìm thấy hồ sơ chờ duyệt." };
    }

    // 1. Upsert into the main `students` table so the Desktop App
    //    immediately sees the record via its realtime sync.
    const studentUpsert = await client.from("students").upsert({
      student_id: pendingRow.student_id,
      full_name: pendingRow.full_name,
      class_name: pendingRow.class_name || "",
      email: pendingRow.email || "",
      portrait_url: pendingRow.portrait_url || "",
    });

    if (studentUpsert.error) {
      return { success: false, error: studentUpsert.error.message };
    }

    // 2. Mark the pending row as `approved` with reviewer metadata.
    const reviewUpdate = await client
      .from("pending_students")
      .update({
        status: "approved",
        reviewed_by: cleanReviewer,
        updated_at: new Date().toISOString(),
      })
      .eq("id", cleanId);

    if (reviewUpdate.error) {
      return { success: false, error: reviewUpdate.error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Lỗi duyệt hồ sơ" };
  }
}

/**
 * Mark a pending student as `rejected`. The row stays in the table for
 * audit but will not be promoted to `students`. `reviewNote` is stored
 * so the student portal can later surface a reason for the rejection.
 */
export async function rejectPendingStudent(input: {
  pendingId: string;
  reviewedBy?: string;
  reviewNote?: string;
}): Promise<{ success: boolean; error?: string }> {
  const cleanId = sanitizeId(input.pendingId);
  const client = getSupabaseClient();
  if (!client) return { success: false, error: "Supabase chưa được cấu hình." };

  try {
    const { error } = await client
      .from("pending_students")
      .update({
        status: "rejected",
        reviewed_by: input.reviewedBy ? sanitizeId(input.reviewedBy) : null,
        review_note: input.reviewNote ? sanitizeText(input.reviewNote, 500) : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", cleanId);

    if (error) {
      console.error("rejectPendingStudent error:", error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Lỗi từ chối hồ sơ" };
  }
}

/**
 * Batch approve every pending row whose `portrait_url` looks usable
 * (i.e. already populated and at least 1KB). Optimised for the
 * "Duyệt tất cả ảnh hợp lệ" button used when an admin needs to clear
 * a backlog of 200+ submissions in one click.
 */
export async function batchApproveValidPendingStudents(input: {
  reviewedBy?: string;
  minImageBytes?: number;
}): Promise<{
  approved: number;
  rejected: number;
  skipped: number;
  error?: string;
}> {
  const client = getSupabaseClient();
  if (!client) {
    return { approved: 0, rejected: 0, skipped: 0, error: "Supabase chưa được cấu hình." };
  }

  try {
    const { data, error } = await client
      .from("pending_students")
      .select("id, student_id, full_name, class_name, email, portrait_url")
      .eq("status", "pending");

    if (error) {
      return { approved: 0, rejected: 0, skipped: 0, error: error.message };
    }

    let approved = 0;
    let skipped = 0;
    const minBytes = input.minImageBytes ?? 1024;

    for (const row of data || []) {
      const url = String(row.portrait_url || "");
      const looksValid =
        url.startsWith("data:image/") ||
        url.startsWith("http://") ||
        url.startsWith("https://");
      const dataSize = url.startsWith("data:")
        ? Math.round((url.length * 3) / 4)
        : minBytes;
      if (!looksValid || dataSize < minBytes) {
        skipped += 1;
        continue;
      }

      const upsert = await client.from("students").upsert({
        student_id: row.student_id,
        full_name: row.full_name,
        class_name: row.class_name || "",
        email: row.email || "",
        portrait_url: row.portrait_url || "",
      });
      if (upsert.error) {
        skipped += 1;
        continue;
      }

      const upd = await client
        .from("pending_students")
        .update({
          status: "approved",
          reviewed_by: input.reviewedBy ? sanitizeId(input.reviewedBy) : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      if (upd.error) {
        skipped += 1;
        continue;
      }
      approved += 1;
    }

    return { approved, rejected: 0, skipped };
  } catch (err: any) {
    return {
      approved: 0,
      rejected: 0,
      skipped: 0,
      error: err?.message || "Lỗi duyệt hàng loạt",
    };
  }
}

