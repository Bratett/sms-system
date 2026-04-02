"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";

const parentLinks = [
  { href: "/parent", label: "Dashboard" },
  { href: "/parent/children", label: "My Children" },
  { href: "/parent/fees", label: "Fees" },
  { href: "/parent/results", label: "Results" },
  { href: "/parent/attendance", label: "Attendance" },
  { href: "/parent/messages", label: "Messages" },
];

const studentLinks = [
  { href: "/student", label: "Dashboard" },
  { href: "/student/results", label: "My Results" },
  { href: "/student/timetable", label: "Timetable" },
  { href: "/student/attendance", label: "Attendance" },
  { href: "/student/exeat", label: "Exeat" },
];

const staffLinks = [
  { href: "/staff", label: "Dashboard" },
  { href: "/staff/daily-schedule", label: "Today" },
  { href: "/staff/timetable", label: "My Timetable" },
  { href: "/staff/profile", label: "My Profile" },
  { href: "/staff/leave", label: "My Leave" },
  { href: "/staff/payslips", label: "My Payslips" },
  { href: "/staff/attendance", label: "My Attendance" },
];

interface PortalNavProps {
  role: string;
  userName: string;
}

export function PortalNav({ role }: PortalNavProps) {
  const pathname = usePathname();
  const links = role === "parent" ? parentLinks : role === "staff" ? staffLinks : studentLinks;

  return (
    <nav className="sticky top-16 z-20 border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex items-center justify-between">
          <div className="-mb-px flex gap-1 overflow-x-auto scrollbar-none">
            {links.map((link) => {
              const isActive =
                pathname === link.href ||
                (link.href !== "/parent" &&
                  link.href !== "/student" &&
                  pathname.startsWith(link.href));

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                    isActive
                      ? "border-teal-600 text-teal-600"
                      : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="ml-4 hidden whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 sm:block"
          >
            Sign Out
          </button>
        </div>
      </div>
    </nav>
  );
}
