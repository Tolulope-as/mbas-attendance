

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AuthShell, Field } from "@/components/AuthShell";
import { Fingerprint, Check, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/student-signup")({
  head: () => ({ meta: [{ title: "Student Signup · Lecture Attendance" }] }),
  component: StudentSignup,
});

// ---------- WebAuthn helpers ----------

function bufferToBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

async function registerBiometric(matricNo: string): Promise<{
  credentialId: string;
  publicKey: string;
  registeredAt: string;
  device: string;
} | null> {
  if (!window.PublicKeyCredential) {
    throw new Error("WebAuthn is not supported in this browser.");
  }

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = new TextEncoder().encode(matricNo);

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: {
        name: "ClassConnect",
      },
      user: {
        id: userId,
        name: matricNo,
        displayName: matricNo,
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },  // ES256
        { type: "public-key", alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform", // uses device biometric (fingerprint/face)
        userVerification: "required",
      },
      timeout: 60000,
      attestation: "none",
    },
  }) as PublicKeyCredential | null;

  if (!credential) return null;

  const response = credential.response as AuthenticatorAttestationResponse;

  return {
    credentialId: bufferToBase64(credential.rawId),
    publicKey: bufferToBase64(response.getPublicKey() ?? new ArrayBuffer(0)),
    registeredAt: new Date().toISOString(),
    device: "webauthn-platform",
  };
}

// ---------- Component ----------

function StudentSignup() {
  const navigate = useNavigate();
  const [registered, setRegistered] = useState(false);
  const [passkeyData, setPasskeyData] = useState<object | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [biometricError, setBiometricError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [registeringBio, setRegisteringBio] = useState(false);

  const handleRegisterBiometric = async (matricNo: string) => {
    if (!matricNo.trim()) {
      setBiometricError("Please enter your matric number first.");
      return;
    }
    setBiometricError(null);
    setRegisteringBio(true);
    try {
      const result = await registerBiometric(matricNo.trim().toUpperCase());
      if (result) {
        setPasskeyData(result);
        setRegistered(true);
      }
    } catch (err: any) {
      if (err.name === "NotAllowedError") {
        setBiometricError("Biometric registration was cancelled or denied. Please try again.");
      } else if (err.name === "NotSupportedError" || err.message?.includes("not supported")) {
        setBiometricError("This device does not support biometric authentication.");
      } else if (location.protocol !== "https:") {
        setBiometricError("Biometrics require HTTPS. Please use the deployed app on Vercel to register.");
      } else {
        setBiometricError(err.message || "Biometric registration failed.");
      }
    } finally {
      setRegisteringBio(false);
    }
  };

  return (
    <AuthShell
      title="Create Student Account"
      footer={
        <>
          Already registered?{" "}
          <Link to="/auth/student-login" className="text-primary font-semibold hover:underline">
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
          const fd = new FormData(e.currentTarget);
          const fullName = String(fd.get("fullName") ?? "").trim();
          const matricNo = String(fd.get("matric") ?? "").trim().toUpperCase();

          const { data: existing } = await supabase
            .from("students")
            .select("id")
            .eq("matric_no", matricNo)
            .maybeSingle();

          if (existing) {
            setError("A student with this matric number already exists.");
            setSubmitting(false);
            return;
          }

          const { error: insertErr } = await supabase
            .from("students")
            .insert({ full_name: fullName, matric_no: matricNo, passkey_credential: passkeyData });

          if (insertErr) {
            setError(insertErr.message);
            setSubmitting(false);
            return;
          }

          navigate({ to: "/auth/student-login" });
        }}
      >
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <Field id="fullName" label="Full Name" placeholder="John Okafor" required />
        <Field id="matric" label="Matriculation Number" placeholder="e.g. FT23CMP0396" required />

        {biometricError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {biometricError}
          </div>
        )}

        <div className="pt-2">
          <button
            type="button"
            onClick={() => {
              const matricInput = document.getElementById("matric") as HTMLInputElement;
              handleRegisterBiometric(matricInput?.value ?? "");
            }}
            disabled={registered || registeringBio}
            className={`w-full rounded-xl py-4 px-4 font-bold flex items-center justify-center gap-3 transition border-2 ${
              registered
                ? "bg-accent/20 border-accent text-navy"
                : "bg-background border-primary text-primary hover:bg-primary hover:text-primary-foreground shadow-card"
            } disabled:opacity-50`}
          >
            {registered ? (
              <>
                <Check className="w-5 h-5" />
                Biometrics Registered
              </>
            ) : registeringBio ? (
              <>
                <Fingerprint className="w-6 h-6 animate-pulse" />
                Waiting for biometric…
              </>
            ) : (
              <>
                <Fingerprint className="w-6 h-6" />
                Register Biometrics
              </>
            )}
          </button>
        </div>

        <button
          type="submit"
          className="w-full h-11 mt-2 rounded-lg bg-primary hover:bg-primary-hover text-primary-foreground font-semibold flex items-center justify-center gap-2 transition shadow-card disabled:opacity-50"
          disabled={!registered || submitting}
        >
          <UserPlus className="w-4 h-4" />
          {submitting ? "Registering…" : "Complete Signup"}
        </button>
      </form>
    </AuthShell>
  );
}
