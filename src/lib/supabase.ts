// src/lib/supabase.ts
// Supabase Client and Database Operations for TrackingZ DLU Web Admin.
import { createClient, type SupabaseClient, type RealtimeChannel } from "@supabase/supabase-js";
import { getCloudConfig } from "./config";
import type { VisitRecord, StudentSummary, VisitStatus, CameraOption } from "../data/types";

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
 */
export async function fetchStudents(): Promise<StudentSummary[]> {
  const client = getSupabaseClient();
  if (!client) {
    return [...localStudents];
  }

  try {
    const { data, error } = await client
      .from("students")
      .select("*")
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
    return data.map((d: any) => {
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
  // Update local store
  const existingIdx = localStudents.findIndex((s) => s.studentId === student.student_id);
  const updatedItem: any = {
    studentId: student.student_id,
    name: student.full_name,
    className: student.class_name,
    totalVisits: existingIdx >= 0 ? localStudents[existingIdx].totalVisits : 0,
    servedCount: existingIdx >= 0 ? localStudents[existingIdx].servedCount : 0,
    avgWaitSecs: existingIdx >= 0 ? localStudents[existingIdx].avgWaitSecs : 0,
    lastSeen: new Date().toISOString(),
    lastCameraId: "CAM-01",
    currentlyInArea: false,
    portraitUrl: student.portrait_url,
  };

  if (existingIdx >= 0) {
    localStudents[existingIdx] = { ...localStudents[existingIdx], ...updatedItem };
  } else {
    localStudents.unshift(updatedItem);
  }

  const client = getSupabaseClient();
  if (!client) {
    return { success: true };
  }

  try {
    const { error } = await client.from("students").upsert({
      student_id: student.student_id,
      full_name: student.full_name,
      class_name: student.class_name,
      email: student.email,
      portrait_url: student.portrait_url,
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
  // 1. Clean local state
  localStudents = localStudents.filter((s) => s.studentId !== studentId);
  localRecords = localRecords.filter((r) => r.studentId !== studentId);

  const client = getSupabaseClient();
  if (!client) {
    return { success: true };
  }

  try {
    // 1. Fetch the student's portrait_url before deleting
    const { data: st } = await client.from("students").select("portrait_url").eq("student_id", studentId).single();
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
    await client.from("student_records").delete().eq("student_id", studentId);

    // 3. Delete student
    const { error } = await client.from("students").delete().eq("student_id", studentId);

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
 */
export async function fetchVisitRecords(): Promise<VisitRecord[]> {
  const client = getSupabaseClient();
  if (!client) {
    return [...localRecords];
  }

  try {
    const [ { data: recordsData, error: recordsError }, { data: studentsData } ] = await Promise.all([
      client.from("student_records").select("*").order("time_in", { ascending: false }),
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
    const toLocalIso = (isoStr: string) => {
      if (!isoStr) return isoStr;
      return isoStr.replace(/(Z|[+-]\d{2}:?\d{2})$/, '');
    };

    return recordsData.map((d: any) => {
      let status: VisitStatus = "Waiting";
      const s = (d.status || "").toUpperCase();
      if (s === "SERVED" || s === "COMPLETED" || s === "ĐÃ TIẾP NHẬN") status = "Served";
      else if (s === "UNATTENDED" || s === "ABANDONED" || s === "CHƯA TIẾP NHẬN") status = "Unattended";

      const timeIn = toLocalIso(d.time_in || d.created_at) || new Date().toISOString();
      const timeOut = d.time_out ? toLocalIso(d.time_out) : undefined;
      
      const enteredMs = new Date(timeIn).getTime();
      const exitedMs = timeOut ? new Date(timeOut).getTime() : Date.now();
      const durSecs = Math.max(0, Math.round((exitedMs - enteredMs) / 1000));

      // Resolve class name and portrait robustly
      let studentClass = "Unknown";
      let portraitUrl = "";
      const recordStudentId = d.student_id ? String(d.student_id).trim() : null;
      
      if (recordStudentId && studentMap.has(recordStudentId)) {
        const info = studentMap.get(recordStudentId);
        if (info) {
          studentClass = info.className;
          portraitUrl = info.portraitUrl;
        }
      } else if (d.class_name) {
        studentClass = String(d.class_name);
      }
      studentClass = studentClass.trim();

      // Avatar logic
      let computedAvatarUrl = undefined;
      const isRegisteredStudent = recordStudentId && studentMap.has(recordStudentId);
      
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
    });
  } catch (err) {
    console.warn("fetchVisitRecords error, falling back:", err);
    return [...localRecords];
  }
}

/**
 * Dynamically extract distinct classes from Supabase & local students
 */
export async function fetchDistinctClasses(): Promise<string[]> {
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
    return Array.from(new Set(fromDb)).sort();
  } catch {
    const fromLocal = localStudents.map((s) => s.className?.trim()).filter(Boolean);
    return Array.from(new Set(fromLocal)).sort();
  }
}



/**
 * Dynamically extract distinct live cameras from the heartbeat table 'cameras'
 */
export async function fetchDistinctCameras(): Promise<CameraOption[]> {
  const defaultCameras: CameraOption[] = [{ id: "CAM-01", label: "Camera 01", fps: 30, status: "Connected" }];
  const client = getSupabaseClient();
  
  if (!client) return defaultCameras;

  try {
    const { data, error } = await client.from("cameras").select("*");
    if (error || !data || data.length === 0) return defaultCameras;
    
    const now = Date.now();
    return data.map((d: any) => {
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
  } catch (err) {
    return defaultCameras;
  }
}

/**
 * Realtime Subscription listener for student_records table.
 * Automatically receives INSERT, UPDATE, DELETE events without F5 page reloads.
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
