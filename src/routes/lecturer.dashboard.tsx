import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import {
  GraduationCap,
  LogOut,
  PlayCircle,
  Download,
  CheckCircle2,
  Clock,
  Calendar,
  Loader2,
  Radio,
  StopCircle,
  Users,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAttendance } from "@/context/AttendanceContext";
import { supabase } from "@/integrations/supabase/client";
import {
  getCurrentLecturer,
  clearCurrentLecturer,
  type CurrentLecturer,
} from "@/lib/current-user";

export const Route = createFileRoute("/lecturer/dashboard")({
  head: () => ({ meta: [{ title: "Lecturer Dashboard · Lecture Attendance" }] }),
  component: LecturerDashboard,
});

type RosterRow = {
  id: string;
  student_name: string;
  matric_no: string;
  checked_in_at: string;
};

type HistoryRow = {
  id: string;
  session_date: string;
  course_code: string;
  level: string;
  present: number;
  status: string;
};

function LecturerDashboard() {
  const navigate = useNavigate();
  const { session, refresh } = useAttendance();
  const [lecturer, setLecturer] = useState<CurrentLecturer | null>(null);
  const [duration, setDuration] = useState("15");

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const nowTimeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const [sessionDate, setSessionDate] = useState(todayStr);
  const [startTime, setStartTime] = useState(nowTimeStr);
  const [status, setStatus] = useState<"idle" | "locating" | "live" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);

  // Hydrate current lecturer + redirect if missing.
  useEffect(() => {
    const cur = getCurrentLecturer();
    if (!cur) {
      navigate({ to: "/auth/lecturer-login" });
      return;
    }
    setLecturer(cur);
  }, [navigate]);

  // Is this lecturer's session the currently active one?
  const isLive = useMemo(
    () =>
      !!session &&
      !!lecturer &&
      session.status === "Active" &&
      session.lecturer_id === lecturer.id &&
      session.expiry_timestamp > Date.now(),
    [session, lecturer],
  );

  // Reflect DB status into local UI status.
  useEffect(() => {
    if (isLive) setStatus("live");
    else if (status === "live") setStatus("idle");
  }, [isLive, status]);

  // Roster realtime + initial fetch — driven by the active session's id.
  useEffect(() => {
    if (!isLive || !session) {
      setRoster([]);
      return;
    }
    const sessionId = session.id;
    (async () => {
      const { data } = await supabase
        .from("attendance_records")
        .select("id, student_name, matric_no, checked_in_at")
        .eq("session_id", sessionId)
        .order("checked_in_at", { ascending: false });
      if (data) setRoster(data as RosterRow[]);
    })();

    const channel = supabase
      .channel(`attendance_records_${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "attendance_records",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const row = payload.new as RosterRow;
          setRoster((prev) =>
            prev.some((r) => r.id === row.id) ? prev : [row, ...prev],
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isLive, session]);

  // Load past sessions history for this lecturer.
  useEffect(() => {
    if (!lecturer) return;
    (async () => {
      const { data } = await supabase
        .from("attendance_sessions")
        .select("id, session_date, course_code, level, status, attendance_records(count)")
        .eq("lecturer_id", lecturer.id)
        .order("session_date", { ascending: false })
        .limit(20);
      if (data) {
        setHistory(
          data.map((r: any) => ({
            id: r.id,
            session_date: r.session_date,
            course_code: r.course_code,
            level: r.level,
            status: r.status,
            present: r.attendance_records?.[0]?.count ?? 0,
          })),
        );
      }
    })();
  }, [lecturer, isLive, roster.length]);

  const handleSignOut = () => {
    clearCurrentLecturer();
    navigate({ to: "/" });
  };
 

const handleStart = () => {
  setErrorMsg(null);
  if (!lecturer) return;

  const startSession = async (latitude: number, longitude: number) => {
    const durationMinutes = parseInt(duration, 10);
    const expiry_timestamp = Date.now() + durationMinutes * 60_000;
    const { error } = await supabase.from("attendance_sessions").insert({
      lecturer_id: lecturer.id,
      course_code: lecturer.courseCode,
      level: lecturer.level,
      session_date: sessionDate,
      start_time: startTime,
      expiry_timestamp,
      latitude,
      longitude,
      status: "Active",
    });
    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
      return;
    }
    await refresh();
    setStatus("live");
  };

  if (!("geolocation" in navigator)) {
    setStatus("error");
    setErrorMsg("Geolocation is not supported in this browser.");
    return;
  }

  setStatus("locating");
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude, longitude } = position.coords;
      await startSession(latitude, longitude);
    },
    async () => {
      // Fallback for local dev (http) where geolocation is blocked
      // Replace these with your actual coordinates if needed
      await startSession(9.0579, 7.4951); // Abuja coordinates as default
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
  );
};


 const handleForceStop = async () => {
    if (!session) return;
    await supabase
      .from("attendance_sessions")
      .update({ status: "Expired" })
      .eq("id", session.id);
    await refresh();
    setStatus("idle");
    setErrorMsg(null);
  };


  const exportCsv = () => {
    const header = "matric_no,student_name,checked_in_at";
    const body = roster
      .map((r) => `${r.matric_no},${r.student_name},${r.checked_in_at}`)
      .join("\n");
    const blob = new Blob([`${header}\n${body}`], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${session?.course_code ?? "session"}-${todayStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!lecturer) return null;

  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-background border-b border-border px-5 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary grid place-items-center">
            <GraduationCap className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="text-sm font-semibold text-navy">Lecture Attendance</span>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary transition"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-5 py-6 space-y-6">
        {/* Profile banner */}
        <section className="rounded-2xl bg-primary text-primary-foreground p-5 sm:p-6 shadow-elevated">
          <div className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-primary-foreground/15 grid place-items-center text-xl font-bold">
                {lecturer.fullName
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")}
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-primary-foreground/70">
                  Lecturer Profile
                </p>
                <h1 className="text-xl sm:text-2xl font-bold leading-tight">
                  {lecturer.fullName}
                </h1>
                <p className="text-sm text-primary-foreground/85 mt-0.5">
                  Course: <span className="font-semibold">{lecturer.courseCode}</span>
                  <span className="mx-2 opacity-60">|</span>
                  Level: <span className="font-semibold">{lecturer.level}</span>
                </p>
              </div>
            </div>
          
          </div>
        </section>

        {/* Start Attendance */}
        <section className="bg-card rounded-2xl border border-border shadow-card p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <PlayCircle className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-navy">Start Attendance Session</h2>
          </div>

          <div className="grid gap-4">
            <div>
              <label className="block text-sm font-medium text-navy mb-1.5">
                Session Duration
              </label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger className="h-11 bg-background">
                  <Clock className="w-4 h-4 text-muted-foreground mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 minutes</SelectItem>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-navy mb-1.5">
                  Session Date
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="date"
                    value={sessionDate}
                    onChange={(e) => setSessionDate(e.target.value)}
                    className="h-11 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-navy mb-1.5">
                  Start Time
                </label>
                <div className="relative">
                  <Clock className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="h-11 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
            </div>

            {isLive && (
              <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-medium text-primary flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                <span>Success: Class location and parameters locked in.</span>
              </div>
            )}
            {status === "error" && errorMsg && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
                {errorMsg}
              </div>
            )}

            <button
              type="button"
              onClick={handleStart}
              disabled={status === "locating" || isLive}
              className={
                isLive
                  ? "w-full h-12 rounded-lg bg-amber-400 text-amber-950 font-semibold flex items-center justify-center gap-2 shadow-card animate-pulse cursor-not-allowed"
                  : status === "locating"
                    ? "w-full h-12 rounded-lg bg-amber-400 text-amber-950 font-semibold flex items-center justify-center gap-2 shadow-card cursor-wait"
                    : "w-full h-12 rounded-lg bg-primary hover:bg-primary-hover text-primary-foreground font-semibold flex items-center justify-center gap-2 transition shadow-card"
              }
            >
              {isLive ? (
                <>
                  <Radio className="w-5 h-5" />
                  Session Live - Capturing Attendance...
                </>
              ) : status === "locating" ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Capturing GPS location...
                </>
              ) : (
                <>
                  <PlayCircle className="w-5 h-5" />
                  Start Attendance Session
                </>
              )}
            </button>

            {isLive && (
              <button
                type="button"
                onClick={handleForceStop}
                className="w-full h-11 rounded-lg bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold flex items-center justify-center gap-2 transition shadow-card"
              >
                <StopCircle className="w-5 h-5" />
                Force Stop Session
              </button>
            )}
          </div>
        </section>

        {/* Live Roster (only while live) */}
        {isLive && (
          <section className="bg-card rounded-2xl border-2 border-accent shadow-card p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold text-navy">Live Attendance Roster</h2>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-3 py-1 text-sm font-bold">
                Total Checked-In: {roster.length}
              </span>
            </div>
            {roster.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Awaiting student check-ins…
              </p>
            ) : (
              <div className="overflow-x-auto -mx-5 sm:mx-0">
                <table className="w-full text-sm min-w-[480px]">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                      <th className="px-5 sm:px-3 py-2.5 font-semibold">Matric No</th>
                      <th className="px-3 py-2.5 font-semibold">Student</th>
                      <th className="px-5 sm:px-3 py-2.5 font-semibold">Checked In</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roster.map((r) => (
                      <tr key={r.id} className="border-b border-border last:border-0">
                        <td className="px-5 sm:px-3 py-3 text-navy font-medium">{r.matric_no}</td>
                        <td className="px-3 py-3 text-foreground">{r.student_name}</td>
                        <td className="px-5 sm:px-3 py-3 text-muted-foreground">
                          {new Date(r.checked_in_at).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* History */}
        <section className="bg-card rounded-2xl border border-border shadow-card p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <h2 className="text-lg font-semibold text-navy">Attendance History</h2>
            {/* <button
              type="button"
              onClick={exportCsv}
              disabled={!isLive || roster.length === 0}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-navy text-navy-foreground text-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button> */}
          </div>

          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              No past sessions yet. Start one above to populate this list.
            </p>
          ) : (
            <div className="overflow-x-auto -mx-5 sm:mx-0">
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="px-5 sm:px-3 py-2.5 font-semibold">Date</th>
                    <th className="px-3 py-2.5 font-semibold">Course</th>
                    <th className="px-3 py-2.5 font-semibold">Level</th>
                    <th className="px-3 py-2.5 font-semibold">Present</th>
                    <th className="px-5 sm:px-3 py-2.5 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-border last:border-0 hover:bg-secondary/50 transition"
                    >
                      <td className="px-5 sm:px-3 py-3 text-navy font-medium">{row.session_date}</td>
                      <td className="px-3 py-3 text-foreground">{row.course_code}</td>
                      <td className="px-3 py-3 text-foreground">{row.level}</td>
                      <td className="px-3 py-3 text-foreground font-semibold">{row.present}</td>
                      <td className="px-5 sm:px-3 py-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-semibold">
                          <CheckCircle2 className="w-3 h-3" />
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}