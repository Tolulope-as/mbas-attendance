import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AuthShell, Field } from "@/components/AuthShell";
import { LogIn } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { hashPassword, setCurrentLecturer } from "@/lib/current-user";

export const Route = createFileRoute("/auth/lecturer-login")({
  head: () => ({ meta: [{ title: "Lecturer Login · Lecture Attendance" }] }),
  component: LecturerLogin,
});

function LecturerLogin() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  return (
    <AuthShell
      title="Lecturer Sign In"
      subtitle="Create attendance sessions"
      footer={
        <>
          New to the portal?{" "}
          <Link to="/auth/lecturer-signup" className="text-primary font-semibold hover:underline">
            Create lecturer account
          </Link>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setSubmitting(true);
          const fd = new FormData(e.currentTarget);
          const email = String(fd.get("email") ?? "").trim().toLowerCase();
          const password = String(fd.get("password") ?? "");
          const hash = await hashPassword(password);
          const { data, error: qErr } = await supabase
            .from("lecturers")
            .select("id, full_name, email, course_code, level, password_hash")
            .eq("email", email)
            .maybeSingle();
          if (qErr || !data || data.password_hash !== hash) {
            setError("Invalid email or password.");
            setSubmitting(false);
            return;
          }
          setCurrentLecturer({
            id: data.id,
            fullName: data.full_name,
            email: data.email,
            courseCode: data.course_code,
            level: data.level,
          });
          navigate({ to: "/lecturer/dashboard" });
        }}
      >
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
        <Field id="email" label="Email" type="email" placeholder="you@nsuk.edu.ng" required />
        <Field id="password" label="Password" type="password" placeholder="••••••••" required />

        <button
          type="submit"
          disabled={submitting}
          className="w-full h-11 mt-2 rounded-lg bg-primary hover:bg-primary-hover text-primary-foreground font-semibold flex items-center justify-center gap-2 transition shadow-card disabled:opacity-60"
        >
          <LogIn className="w-4 h-4" />
          {submitting ? "Signing in…" : "Login"}
        </button>
      </form>
    </AuthShell>
  );
}
