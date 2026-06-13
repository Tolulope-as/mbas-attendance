// Lightweight localStorage-backed identity store for the demo app.
// so the "current user" is just the row id + display fields cached client-side.

export type CurrentLecturer = {
  id: string;
  fullName: string;
  email: string;
  courseCode: string;
  level: string;
};

export type CurrentStudent = {
  id: string;
  fullName: string;
  matricNo: string;
};

const LECTURER_KEY = "campus-guard:current-lecturer";
const STUDENT_KEY = "campus-guard:current-student";

function read<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export const getCurrentLecturer = () => read<CurrentLecturer>(LECTURER_KEY);
export const setCurrentLecturer = (v: CurrentLecturer) => write(LECTURER_KEY, v);
export const clearCurrentLecturer = () => window.localStorage.removeItem(LECTURER_KEY);

export const getCurrentStudent = () => read<CurrentStudent>(STUDENT_KEY);
export const setCurrentStudent = (v: CurrentStudent) => write(STUDENT_KEY, v);
export const clearCurrentStudent = () => window.localStorage.removeItem(STUDENT_KEY);

// // Simple SHA-256 wrapper for demo password hashing (Web Crypto, browser-only).
// export async function hashPassword(plain: string): Promise<string> {
//   const buf = new TextEncoder().encode(plain);
//   const digest = await crypto.subtle.digest("SHA-256", buf);
//   return Array.from(new Uint8Array(digest))
//     .map((b) => b.toString(16).padStart(2, "0"))
//     .join("");
// }

export async function hashPassword(plain: string): Promise<string> {
  if (crypto.subtle) {
    const buf = new TextEncoder().encode(plain);
    const digest = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // Fallback for non-secure contexts (local dev)
  return btoa(plain);
}