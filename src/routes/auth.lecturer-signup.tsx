import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AuthShell, Field } from "@/components/AuthShell";
import { UserPlus, ChevronDown } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { hashPassword } from "@/lib/current-user";

export const Route = createFileRoute("/auth/lecturer-signup")({
  head: () => ({ meta: [{ title: "Lecturer Signup · Lecture Attendance" }] }),
  component: LecturerSignup,
});

function LecturerSignup() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  return (
    <AuthShell
      title="Create Lecturer Account"
      subtitle="Register to manage your course attendance"
      footer={
        <>
          Already have an account?{" "}
          <Link to="/auth/lecturer-login" className="text-primary font-semibold hover:underline">
            Sign in
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
          const form = e.currentTarget;
          const fd = new FormData(form);
          const email = String(fd.get("email") ?? "").trim().toLowerCase();
          const fullName = String(fd.get("fullName") ?? "").trim();
          const courseCode = String(fd.get("courseCode") ?? "").trim();
          const level = String(fd.get("level") ?? "").trim();
          const password = String(fd.get("password") ?? "");

          const { data: existing } = await supabase
            .from("lecturers")
            .select("id")
            .eq("email", email)
            .maybeSingle();
          if (existing) {
            setError("An account with this email already exists.");
            setSubmitting(false);
            return;
          }
          const password_hash = await hashPassword(password);
          const { error: insertErr } = await supabase.from("lecturers").insert({
            full_name: fullName,
            email,
            password_hash,
            course_code: courseCode,
            level,
          });
          if (insertErr) {
            setError(insertErr.message);
            setSubmitting(false);
            return;
          }
          navigate({ to: "/auth/lecturer-login" });
        }}
      >
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
        <Field id="fullName" label="Full Name" placeholder="Dr. Jane Adeyemi" required />
        <Field id="email" label="Email" type="email" placeholder="you@nsuk.edu.ng" required />
        <Field id="password" label="Password" type="password" placeholder="At least 8 characters" required />
        <Field id="courseCode" label="Course Code" placeholder="e.g. GST 311" required />

        <div className="space-y-1.5">
          <label htmlFor="level" className="block text-sm font-medium text-navy">Level</label>
          <div className="relative">
            <select
              id="level"
              name="level"
              required
              defaultValue=""
              className="w-full h-11 px-3.5 pr-10 rounded-lg border border-input bg-background text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition"
            >
              <option value="" disabled>Select level</option>
              <option value="100">100 Level</option>
              <option value="200">200 Level</option>
              <option value="300">300 Level</option>
              <option value="400">400 Level</option>
              <option value="500">500 Level</option>
            </select>
            <ChevronDown className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full h-11 mt-2 rounded-lg bg-primary hover:bg-primary-hover text-primary-foreground font-semibold flex items-center justify-center gap-2 transition shadow-card disabled:opacity-60"
        >
          <UserPlus className="w-4 h-4" />
          {submitting ? "Creating…" : "Create Account"}
        </button>
      </form>
    </AuthShell>
  );
}
