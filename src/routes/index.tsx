import { createFileRoute, Link } from "@tanstack/react-router";
import { GraduationCap, BookOpenCheck, UserRound, ArrowRight, MapPin, Fingerprint } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lecture Attendance " },
      { name: "description", content: "Biometric and location-verified attendance for lecturers and students." },
    ],
  }),
  component: Gateway,
});

function Gateway() {
  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <header className="px-5 sm:px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary grid place-items-center shadow-elevated">
            <GraduationCap className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-base font-semibold text-navy tracking-tight">Lecture Attendance</span>
        </div>
  
      </header>

      <main className="flex-1 flex items-center justify-center px-5 py-8 sm:py-12">
        <div className="w-full max-w-4xl">
          <div className="text-center mb-10 sm:mb-14">
            
            <h1 className="text-3xl sm:text-5xl font-extrabold text-navy tracking-tight leading-tight">
              NSUK Lecture Attendance Portal
            </h1>
            <p className="mt-4 text-sm sm:text-base text-muted-foreground max-w-xl mx-auto">
              Sign in to mark, manage, and verify class attendance securely using location and biometrics.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
            <RoleCard
              to="/auth/lecturer-login"
              icon={<BookOpenCheck className="w-6 h-6" />}
              title="I am a Lecturer"
              description="Create attendance sessions and view reports."
            />
            <RoleCard
              to="/auth/student-login"
              icon={<UserRound className="w-6 h-6" />}
              
              title="I am a Student"
              description="Mark attendance."
            />
          </div>

        </div>
      </main>

      
    </div>
  );
}

function RoleCard({
  to,
  icon,
  title,
  description,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      to={to}
      className="group relative block rounded-2xl bg-card border-2 border-primary/15 hover:border-primary p-6 sm:p-7 shadow-card hover:shadow-elevated transition-all duration-200 hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between mb-5">
        <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary grid place-items-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
          {icon}
        </div>
        <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
      </div>
      <h2 className="text-lg sm:text-xl font-bold text-navy tracking-tight">{title}</h2>
      <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{description}</p>
    </Link>
  );
}
