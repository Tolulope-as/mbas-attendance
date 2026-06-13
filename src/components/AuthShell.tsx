import { Link } from "@tanstack/react-router";
import { GraduationCap, ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <header className="px-5 py-4 flex items-center justify-between border-b border-border bg-background">
        <Link to="/" className="flex items-center gap-2 text-navy hover:text-primary transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Back</span>
        </Link>
      
      </header>

      <main className="flex-1 flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="text-2xl sm:text-3xl font-bold text-navy tracking-tight">{title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
          </div>

          <div className="bg-card rounded-2xl border border-border shadow-card p-6 sm:p-8">
            {children}
          </div>

          {footer && (
            <div className="mt-6 text-center text-sm text-muted-foreground">
              {footer}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

interface FieldProps {
  label: string;
  id: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
}

export function Field({ label, id, type = "text", placeholder, required }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-navy">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        placeholder={placeholder}
        required={required}
        className="w-full h-11 px-3.5 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition"
      />
    </div>
  );
}
