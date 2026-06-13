// import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
// import { AuthShell, Field } from "@/components/AuthShell";
// import { Fingerprint, Loader2 } from "lucide-react";
// import { useState } from "react";
// import { supabase } from "@/integrations/supabase/client";
// import { setCurrentStudent } from "@/lib/current-user";

// export const Route = createFileRoute("/auth/student-login")({
//   head: () => ({ meta: [{ title: "Student Login · Lecture Attendance" }] }),
//   component: StudentLogin,
// });

// function StudentLogin() {
//   const navigate = useNavigate();
//   const [authenticating, setAuthenticating] = useState(false);
//   const [error, setError] = useState<string | null>(null);

//   return (
//     <AuthShell
//       title="Student Sign In"
//       footer={
//         <>
//           New here?{" "}
//           <Link to="/auth/student-signup" className="text-primary font-semibold hover:underline">
//             Register as a student
//           </Link>
//         </>
//       }
//     >
//       <form
//         className="space-y-5"
//         onSubmit={async (e) => {
//           e.preventDefault();
//           setError(null);
//           const fd = new FormData(e.currentTarget);
//           const matricNo = String(fd.get("matric") ?? "").trim().toUpperCase();
//           setAuthenticating(true);
//           const { data, error: qErr } = await supabase
//             .from("students")
//             .select("id, full_name, matric_no, passkey_credential")
//             .eq("matric_no", matricNo)
//             .maybeSingle();
//           if (qErr || !data) {
//             setError("Matric number not found. Please register first.");
//             setAuthenticating(false);
//             return;
//           }
//           if (!data.passkey_credential) {
//             setError("No biometric passkey registered for this matric number.");
//             setAuthenticating(false);
//             return;
//           }
//           // Simulate biometric verification delay against the stored passkey.
//           setTimeout(() => {
//             setCurrentStudent({
//               id: data.id,
//               fullName: data.full_name,
//               matricNo: data.matric_no,
//             });
//             navigate({ to: "/student/dashboard" });
//           }, 800);
//         }}
//       >
//         {error && (
//           <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
//             {error}
//           </div>
//         )}
//         <Field id="matric" label="Matriculation Number" placeholder="e.g. FT23CMP002" required />

//         <button
//           type="submit"
//           disabled={authenticating}
//           className="w-full rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-70 disabled:cursor-not-allowed text-primary-foreground font-bold py-4 flex items-center justify-center gap-3 transition shadow-elevated text-base"
//         >
//           {authenticating ? (
//             <>
//               <Loader2 className="w-6 h-6 animate-spin" />
//               Authenticating Biometrics…
//             </>
//           ) : (
//             <>
//               <Fingerprint className="w-6 h-6" />
//               Scan Fingerprint to Login
//             </>
//           )}
//         </button>

//         <p className="text-xs text-center text-muted-foreground">
//           Your biometrics will be used to verify your identity .
//         </p>
//       </form>
//     </AuthShell>
//   );
// }



import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AuthShell, Field } from "@/components/AuthShell";
import { Fingerprint, Loader2 } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { setCurrentStudent } from "@/lib/current-user";

export const Route = createFileRoute("/auth/student-login")({
  head: () => ({ meta: [{ title: "Student Login · Lecture Attendance" }] }),
  component: StudentLogin,
});

// ---------- WebAuthn helper ----------

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function verifyBiometric(credentialId: string): Promise<boolean> {
  if (!window.PublicKeyCredential) {
    throw new Error("WebAuthn is not supported in this browser.");
  }

  const challenge = crypto.getRandomValues(new Uint8Array(32));

  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [
        {
          type: "public-key",
          id: base64ToBuffer(credentialId),
        },
      ],
      userVerification: "required",
      timeout: 60000,
    },
  }) as PublicKeyCredential | null;

  return !!assertion;
}

// ---------- Component ----------

function StudentLogin() {
  const navigate = useNavigate();
  const [authenticating, setAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <AuthShell
      title="Student Sign In"
      footer={
        <>
          New here?{" "}
          <Link to="/auth/student-signup" className="text-primary font-semibold hover:underline">
            Register as a student
          </Link>
        </>
      }
    >
      <form
        className="space-y-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          const fd = new FormData(e.currentTarget);
          const matricNo = String(fd.get("matric") ?? "").trim().toUpperCase();
          setAuthenticating(true);

          // 1. Look up student by matric number
          const { data, error: qErr } = await supabase
            .from("students")
            .select("id, full_name, matric_no, passkey_credential")
            .eq("matric_no", matricNo)
            .maybeSingle();

          if (qErr || !data) {
            setError("Matric number not found. Please register first.");
            setAuthenticating(false);
            return;
          }

          if (!data.passkey_credential) {
            setError("No biometric passkey registered for this matric number.");
            setAuthenticating(false);
            return;
          }

          // 2. Verify biometric using stored credential ID
          try {
            const credential = data.passkey_credential as { credentialId: string };
            const verified = await verifyBiometric(credential.credentialId);

            if (!verified) {
              setError("Biometric verification failed. Please try again.");
              setAuthenticating(false);
              return;
            }

            // 3. Login successful
            setCurrentStudent({
              id: data.id,
              fullName: data.full_name,
              matricNo: data.matric_no,
            });
            navigate({ to: "/student/dashboard" });

          } catch (err: any) {
            if (err.name === "NotAllowedError") {
              setError("Biometric verification was cancelled. Please try again.");
            } else if (location.protocol !== "https:") {
              setError("Biometrics require HTTPS. Please use the deployed app on Vercel.");
            } else {
              setError(err.message || "Biometric verification failed.");
            }
            setAuthenticating(false);
          }
        }}
      >
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <Field id="matric" label="Matriculation Number" placeholder="e.g. FT23CMP002" required />

        <button
          type="submit"
          disabled={authenticating}
          className="w-full rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-70 disabled:cursor-not-allowed text-primary-foreground font-bold py-4 flex items-center justify-center gap-3 transition shadow-elevated text-base"
        >
          {authenticating ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin" />
              Authenticating Biometrics…
            </>
          ) : (
            <>
              <Fingerprint className="w-6 h-6" />
              Scan Fingerprint to Login
            </>
          )}
        </button>

        <p className="text-xs text-center text-muted-foreground">
          Your biometrics will be used to verify your identity.
        </p>
      </form>
    </AuthShell>
  );
}



