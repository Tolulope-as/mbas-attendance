import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  GraduationCap,
  LogOut,
  MapPin,
  Fingerprint,
  CheckCircle2,
  Clock,
  Navigation,
  AlertTriangle,
} from "lucide-react";
import { useAttendance } from "@/context/AttendanceContext";
import { supabase } from "@/integrations/supabase/client";
import {
  getCurrentStudent,
  clearCurrentStudent,
  type CurrentStudent,
} from "@/lib/current-user";

export const Route = createFileRoute("/student/dashboard")({
  head: () => ({ meta: [{ title: "Student Dashboard · Lecture Attendance" }] }),
  component: StudentDashboard,
});

type HistoryRow = { date: string; course: string; status: string };

function useCountdownTo(expiresAt: number | null) {
  const [, tick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(i);
  }, []);
  if (!expiresAt) return "00:00";
  const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function distanceMeters(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function StudentDashboard() {
  const navigate = useNavigate();
  const { session } = useAttendance();
  const [student, setStudent] = useState<CurrentStudent | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);

  // Tick every second so the active/expired gate re-evaluates in real time.
  const [, force] = useState(0);
  useEffect(() => {
    const i = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(i);
  }, []);

  // Hydrate current student + their attendance history.
  useEffect(() => {
    const cur = getCurrentStudent();
    if (!cur) {
      navigate({ to: "/auth/student-login" });
      return;
    }
    setStudent(cur);
    (async () => {
      const { data } = await supabase
        .from("attendance_records")
        .select("checked_in_at, attendance_sessions(course_code)")
        .eq("student_id", cur.id)
        .order("checked_in_at", { ascending: false })
        .limit(20);
      if (data) {
        setHistory(
          data.map((r: any) => ({
            date: new Date(r.checked_in_at).toISOString().slice(0, 10),
            course: r.attendance_sessions?.course_code ?? "—",
            status: "Present",
          })),
        );
      }
    })();
  }, [navigate]);

  const isActive =
    !!session &&
    session.status === "Active" &&
    session.expiry_timestamp > Date.now();
  const remaining = useCountdownTo(isActive ? session!.expiry_timestamp : null);

  const [verifyState, setVerifyState] = useState<
    | { kind: "idle" }
    | { kind: "checking" }
    | { kind: "success"; distance: number }
    | { kind: "error"; message: string; denied?: boolean }
  >({ kind: "idle" });

  const handleSignOut = () => {
    clearCurrentStudent();
    navigate({ to: "/" });
  };

  const handleVerify = () => {
    if (!isActive || !session || !student) {
      setVerifyState({ kind: "error", message: "No active session available." });
      return;
    }
    if (!("geolocation" in navigator)) {
      setVerifyState({ kind: "error", message: "Geolocation not supported." });
      return;
    }
    setVerifyState({ kind: "checking" });

    const checkIn = async (latitude: number, longitude: number) => {
      const d = distanceMeters(
        { lat: latitude, lon: longitude },
        { lat: session.latitude, lon: session.longitude },
      );
      if (d > 200) {
        setVerifyState({
          kind: "error",
          denied: true,
          message: "Access Denied: You must be inside the lecture venue.",
        });
        return;
      }
      const { error } = await supabase.from("attendance_records").insert({
        session_id: session.id,
        student_id: student.id,
        student_name: student.fullName,
        matric_no: student.matricNo,
      });
      if (error) {
        setVerifyState({
          kind: "error",
          message: error.code === "23505"
            ? "You have already been marked present for this session."
            : error.message,
        });
        return;
      }
      setVerifyState({ kind: "success", distance: d });
      const today = new Date().toISOString().slice(0, 10);
      setHistory((h) => [
        { date: today, course: session.course_code, status: "Present" },
        ...h,
      ]);
    };

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await checkIn(pos.coords.latitude, pos.coords.longitude);
      },
      async () => {
        // Fallback for local dev (http) where geolocation is blocked
        await checkIn(9.0579, 7.4951); // Abuja coordinates as default
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  if (!student) return null;




  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-background border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 z-10">
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

      <main className="max-w-md mx-auto px-4 py-5 space-y-5">
        {verifyState.kind === "error" && verifyState.denied && (
          <div className="rounded-xl border-2 border-destructive bg-destructive/10 text-destructive px-4 py-3 text-sm font-semibold flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{verifyState.message}</span>
          </div>
        )}

        <section className="bg-card rounded-2xl border border-border shadow-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 grid place-items-center shrink-0">
              <span className="text-base font-bold text-primary">
                {student.fullName
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-base font-bold text-navy truncate">
                {student.fullName}
              </h1>
              <p className="text-xs text-muted-foreground truncate">
                {student.matricNo}
              </p>
            </div>
          </div>
          
        </section>

        {isActive && session ? (
          <section className="bg-card rounded-2xl border-2 border-accent shadow-card p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
              </span>
              <h2 className="text-sm font-bold text-navy uppercase tracking-wide">
                Active Window
              </h2>
            </div>

            <div className="space-y-2 mb-4">
              <p className="text-lg font-extrabold text-foreground">
                {session.course_code}
              </p>
              <p className="text-sm text-muted-foreground">
                {session.lecturer_name}
              </p>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="w-3.5 h-3.5" />
                {session.latitude.toFixed(5)}, {session.longitude.toFixed(5)}
              </div>
            </div>

            <div className="flex items-center gap-2 mb-4 rounded-xl bg-secondary px-4 py-3">
              <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-semibold text-navy">
                {remaining} remaining
              </span>
            </div>

            <button
              type="button"
              onClick={handleVerify}
              disabled={verifyState.kind === "checking"}
              className="w-full h-14 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground font-bold flex items-center justify-center gap-2 transition shadow-elevated text-base"
            >
              <Navigation className="w-5 h-5" />
              {verifyState.kind === "checking"
                ? "Verifying location..."
                : "Verify Location & Mark Present"}
            </button>

            {verifyState.kind === "success" && (
              <p className="mt-3 rounded-lg bg-primary/10 text-primary px-3 py-2 text-xs font-semibold text-center">
                Present marked. Distance from lecturer: {Math.round(verifyState.distance)} m
              </p>
            )}
            {verifyState.kind === "error" && !verifyState.denied && (
              <p className="mt-3 rounded-lg bg-destructive/10 text-destructive px-3 py-2 text-xs font-semibold text-center">
                {verifyState.message}
              </p>
            )}

          </section>
        ) : (
          <section className="bg-card rounded-2xl border border-border shadow-card p-6 text-center">
            <p className="text-sm font-medium text-muted-foreground">
              No active attendance sessions for your courses at the moment.
            </p>
          </section>
        )}

        <section>
          <div className="flex items-center gap-2 mb-3 px-1">
            <h2 className="text-sm font-bold text-navy uppercase tracking-wide">
              Attendance History
            </h2>
          </div>
          {history.length === 0 ? (
            <p className="text-xs text-muted-foreground px-1">
              No attendance records yet.
            </p>
          ) : (
            <div className="space-y-2">
              {history.map((row, idx) => (
                <div
                  key={`${row.date}-${idx}`}
                  className="flex items-center justify-between bg-card rounded-xl border border-border shadow-sm px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-navy truncate">
                      {row.course}
                    </p>
                    <p className="text-xs text-muted-foreground">{row.date}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-xs font-bold shrink-0 ml-2">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {row.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}