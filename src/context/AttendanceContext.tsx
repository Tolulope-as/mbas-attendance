import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";

export type AttendanceSessionRow = {
  id: string;
  lecturer_id: string;
  course_code: string;
  level: string;
  session_date: string;
  start_time: string;
  expiry_timestamp: number;
  latitude: number;
  longitude: number;
  status: "Active" | "Expired";
  lecturer_name?: string;
};

type Ctx = {
  session: AttendanceSessionRow | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const AttendanceContext = createContext<Ctx | null>(null);

async function fetchActiveSession(): Promise<AttendanceSessionRow | null> {
  const nowMs = Date.now();
  const { data, error } = await supabase
    .from("attendance_sessions")
    .select("*, lecturers(full_name)")
    .eq("status", "Active")
    .gt("expiry_timestamp", nowMs)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as unknown as AttendanceSessionRow & {
    lecturers?: { full_name: string } | null;
  };
  return { ...row, lecturer_name: row.lecturers?.full_name ?? "" };
}

export function AttendanceProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AttendanceSessionRow | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const next = await fetchActiveSession();
    setSession(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    // Realtime: refresh when any session row changes (insert/update).
    const channel = supabase
      .channel("attendance_sessions_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance_sessions" },
        () => {
          refresh();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  const value = useMemo(
    () => ({ session, loading, refresh }),
    [session, loading, refresh],
  );

  return (
    <AttendanceContext.Provider value={value}>{children}</AttendanceContext.Provider>
  );
}

export function useAttendance() {
  const ctx = useContext(AttendanceContext);
  if (!ctx) throw new Error("useAttendance must be used within AttendanceProvider");
  return ctx;
}