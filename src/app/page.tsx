import Link from "next/link";
import { db } from "@/lib/db";
import { MobileNav } from "./mobile-nav";

export default async function LandingPage() {
  const school = await db.school.findFirst({ select: { name: true } });
  const schoolName = school?.name ?? "School Management System";

  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-white">
      {/* ─── Header ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo / School Name */}
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0d9488]">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <span className="hidden text-lg font-bold text-gray-900 sm:block">
              {schoolName}
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden items-center gap-1 lg:flex">
            <a
              href="#features"
              className="rounded-md px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
            >
              Features
            </a>
            <a
              href="#admissions"
              className="rounded-md px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
            >
              Admissions
            </a>
            <a
              href="#contact"
              className="rounded-md px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
            >
              Contact
            </a>
          </nav>

          {/* Desktop CTA Buttons */}
          <div className="hidden items-center gap-3 lg:flex">
            <Link
              href="/login"
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Sign In
            </Link>
            <Link
              href="/apply"
              className="rounded-md bg-[#0d9488] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0f766e]"
            >
              Apply Now
            </Link>
          </div>

          {/* Mobile Nav Toggle */}
          <MobileNav />
        </div>
      </header>

      {/* ─── Hero Section ───────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0d9488] via-[#0f766e] to-[#115e59]">
        {/* Decorative background pattern */}
        <div className="absolute inset-0 opacity-10">
          <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="hero-pattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                <circle cx="20" cy="20" r="1.5" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#hero-pattern)" />
          </svg>
        </div>

        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8 lg:py-40">
          <div className="max-w-3xl">
            <div className="mb-6 inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-medium text-white backdrop-blur-sm">
              <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-300 animate-pulse" />
              Admissions Open for {currentYear}/{currentYear + 1} Academic Year
            </div>

            <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Empowering Academic
              <span className="block text-emerald-200">Excellence</span>
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-teal-100">
              {schoolName} is committed to providing world-class education. Our comprehensive
              management system streamlines academics, admissions, finance, and communication
              for students, parents, and staff.
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Link
                href="/apply"
                className="inline-flex items-center justify-center rounded-lg bg-white px-6 py-3 text-base font-semibold text-[#0d9488] shadow-lg transition-all hover:bg-gray-50 hover:shadow-xl"
              >
                Apply for Admission
                <svg className="ml-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-lg border-2 border-white/30 px-6 py-3 text-base font-semibold text-white transition-all hover:border-white/60 hover:bg-white/10"
              >
                Sign In to Portal
              </Link>
            </div>
          </div>
        </div>

        {/* Decorative wave */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            <path d="M0 80h1440V30c-240 30-480 50-720 40S240 20 0 50v30z" fill="white" />
          </svg>
        </div>
      </section>

      {/* ─── Stats Bar ──────────────────────────────────────────────── */}
      <section className="border-b border-gray-200 bg-white py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {[
              { value: "20+", label: "Academic Programmes" },
              { value: "98%", label: "Graduation Rate" },
              { value: "50+", label: "Qualified Staff" },
              { value: "24/7", label: "Portal Access" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-3xl font-extrabold text-[#0d9488]">{stat.value}</p>
                <p className="mt-1 text-sm font-medium text-gray-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features Grid ──────────────────────────────────────────── */}
      <section id="features" className="bg-gray-50 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Everything You Need in One Platform
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-500">
              Our integrated school management system brings together every aspect of academic
              administration into a seamless experience.
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {/* Feature 1: Academic Tracking */}
            <div className="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-[#0d9488]/30 hover:shadow-md">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#0d9488]/10 text-[#0d9488] transition-colors group-hover:bg-[#0d9488] group-hover:text-white">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">Academic Tracking</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">
                Comprehensive grade management with assessments, report cards, GPA computation,
                class rankings, and real-time academic progress monitoring.
              </p>
            </div>

            {/* Feature 2: Admissions Portal */}
            <div className="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-[#0d9488]/30 hover:shadow-md">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#0d9488]/10 text-[#0d9488] transition-colors group-hover:bg-[#0d9488] group-hover:text-white">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">Admissions Portal</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">
                Online application system supporting both Standard and CSSPS Placement tracks.
                Real-time status tracking, document uploads, and automated notifications.
              </p>
            </div>

            {/* Feature 3: Student Management */}
            <div className="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-[#0d9488]/30 hover:shadow-md">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#0d9488]/10 text-[#0d9488] transition-colors group-hover:bg-[#0d9488] group-hover:text-white">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">Student Management</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">
                Complete student lifecycle management from enrollment to graduation. Track records,
                manage class assignments, guardian information, and student progress.
              </p>
            </div>

            {/* Feature 4: Financial Management */}
            <div className="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-[#0d9488]/30 hover:shadow-md">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#0d9488]/10 text-[#0d9488] transition-colors group-hover:bg-[#0d9488] group-hover:text-white">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">Financial Management</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">
                Streamlined fee management with automated billing, payment tracking, receipt
                generation, and financial reporting for complete transparency.
              </p>
            </div>

            {/* Feature 5: Communication Hub */}
            <div className="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-[#0d9488]/30 hover:shadow-md">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#0d9488]/10 text-[#0d9488] transition-colors group-hover:bg-[#0d9488] group-hover:text-white">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">Communication Hub</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">
                Multi-channel notifications via SMS, email, and in-app messaging. Broadcast
                announcements, send fee reminders, and keep parents informed in real time.
              </p>
            </div>

            {/* Feature 6: Parent & Student Portals */}
            <div className="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-[#0d9488]/30 hover:shadow-md">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#0d9488]/10 text-[#0d9488] transition-colors group-hover:bg-[#0d9488] group-hover:text-white">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">Parent & Student Portals</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">
                Dedicated portals for parents and students to access academic results, fee
                statements, attendance records, timetables, and school announcements.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Admissions CTA Section ─────────────────────────────────── */}
      <section id="admissions" className="bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="inline-flex items-center rounded-full bg-[#0d9488]/10 px-4 py-1.5 text-sm font-medium text-[#0d9488]">
              Now Accepting Applications
            </div>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Begin Your Journey With Us
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-500">
              Choose your application pathway below. Whether you are applying directly or through
              the national CSSPS placement system, our portal makes the process seamless.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-2">
            {/* Standard Application Card */}
            <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-8 shadow-sm transition-all hover:shadow-lg">
              <div className="absolute right-0 top-0 h-32 w-32 -translate-y-8 translate-x-8 rounded-full bg-blue-50" />
              <div className="relative">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                  <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5M6 7.5h3v3H6v-3Z" />
                  </svg>
                </div>
                <h3 className="mt-5 text-xl font-bold text-gray-900">Standard Application</h3>
                <p className="mt-3 text-sm leading-relaxed text-gray-500">
                  For prospective students applying directly to our institution. Complete our
                  online application form with your academic history, programme preferences,
                  and guardian information.
                </p>
                <ul className="mt-5 space-y-2">
                  {["Online multi-step application form", "Programme preference selection", "Real-time application tracking", "Email & SMS notifications"].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-gray-600">
                      <svg className="h-4 w-4 flex-shrink-0 text-[#0d9488]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/apply"
                  className="mt-8 inline-flex items-center rounded-lg bg-[#0d9488] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0f766e]"
                >
                  Start Standard Application
                  <svg className="ml-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
              </div>
            </div>

            {/* CSSPS Placement Card */}
            <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-8 shadow-sm transition-all hover:shadow-lg">
              <div className="absolute right-0 top-0 h-32 w-32 -translate-y-8 translate-x-8 rounded-full bg-amber-50" />
              <div className="relative">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                  <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                  </svg>
                </div>
                <h3 className="mt-5 text-xl font-bold text-gray-900">CSSPS Placement</h3>
                <p className="mt-3 text-sm leading-relaxed text-gray-500">
                  For students placed through the Computerised School Selection and Placement
                  System. Complete your enrollment using your BECE Index Number and the
                  Enrollment Code provided by the placement system.
                </p>
                <ul className="mt-5 space-y-2">
                  {["BECE Index Number verification", "Enrollment Code validation", "Streamlined placement workflow", "Automated school code matching"].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-gray-600">
                      <svg className="h-4 w-4 flex-shrink-0 text-[#0d9488]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/apply"
                  className="mt-8 inline-flex items-center rounded-lg border-2 border-[#0d9488] px-5 py-2.5 text-sm font-semibold text-[#0d9488] transition-colors hover:bg-[#0d9488] hover:text-white"
                >
                  Start Placement Application
                  <svg className="ml-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>

          {/* Status Checker CTA */}
          <div className="mt-10 text-center">
            <p className="text-sm text-gray-500">
              Already submitted an application?{" "}
              <Link
                href="/apply/status"
                className="font-semibold text-[#0d9488] hover:text-[#0f766e] hover:underline"
              >
                Check your application status here
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* ─── Why Choose Us ──────────────────────────────────────────── */}
      <section className="bg-gray-50 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                Why Choose {schoolName}?
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-gray-500">
                We combine academic rigor with modern technology to create an environment where
                every student can thrive. Our integrated platform ensures seamless collaboration
                between students, parents, and educators.
              </p>
              <dl className="mt-8 space-y-5">
                {[
                  {
                    title: "Modern Digital Infrastructure",
                    description: "State-of-the-art school management system with real-time data access for all stakeholders.",
                  },
                  {
                    title: "Transparent Communication",
                    description: "Multi-channel notifications keep parents and students informed about academic progress, fees, and events.",
                  },
                  {
                    title: "Data-Driven Decision Making",
                    description: "Comprehensive analytics and reporting help educators identify areas for improvement and celebrate success.",
                  },
                ].map((item) => (
                  <div key={item.title} className="flex gap-4">
                    <div className="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#0d9488]">
                      <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    </div>
                    <div>
                      <dt className="text-sm font-semibold text-gray-900">{item.title}</dt>
                      <dd className="mt-1 text-sm text-gray-500">{item.description}</dd>
                    </div>
                  </div>
                ))}
              </dl>
            </div>

            {/* Stats card */}
            <div className="rounded-2xl bg-gradient-to-br from-[#0d9488] to-[#115e59] p-8 text-white shadow-xl lg:p-10">
              <h3 className="text-xl font-bold">Our Impact</h3>
              <p className="mt-2 text-sm text-teal-200">
                Delivering measurable results through technology-enhanced education.
              </p>
              <div className="mt-8 grid grid-cols-2 gap-6">
                {[
                  { value: "1000+", label: "Students Enrolled" },
                  { value: "95%", label: "Parent Satisfaction" },
                  { value: "15+", label: "Years of Excellence" },
                  { value: "100%", label: "Digital Records" },
                ].map((stat) => (
                  <div key={stat.label}>
                    <p className="text-2xl font-extrabold">{stat.value}</p>
                    <p className="mt-1 text-xs text-teal-200">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Footer ─────────────────────────────────────────────────── */}
      <footer id="contact" className="bg-gray-900 text-gray-300">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-4">
            {/* About Column */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0d9488]">
                  <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <span className="text-lg font-bold text-white">{schoolName}</span>
              </div>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-gray-400">
                Dedicated to academic excellence and holistic student development. Our
                technology-driven approach ensures every student receives the support
                they need to achieve their full potential.
              </p>
              {/* Social links */}
              <div className="mt-6 flex gap-4">
                {[
                  { label: "Facebook", path: "M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" },
                  { label: "Twitter", path: "M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" },
                  { label: "Instagram", path: "M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37zM17.5 6.5h.01M7.5 2h9A5.5 5.5 0 0 1 22 7.5v9a5.5 5.5 0 0 1-5.5 5.5h-9A5.5 5.5 0 0 1 2 16.5v-9A5.5 5.5 0 0 1 7.5 2z" },
                ].map((social) => (
                  <a
                    key={social.label}
                    href="#"
                    aria-label={social.label}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-800 text-gray-400 transition-colors hover:bg-[#0d9488] hover:text-white"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={social.path} />
                    </svg>
                  </a>
                ))}
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider text-white">Quick Links</h4>
              <ul className="mt-4 space-y-3">
                {[
                  { label: "Sign In", href: "/login" },
                  { label: "Apply for Admission", href: "/apply" },
                  { label: "Check Application Status", href: "/apply/status" },
                  { label: "Features", href: "#features" },
                ].map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-gray-400 transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact Info */}
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider text-white">Contact Us</h4>
              <ul className="mt-4 space-y-3">
                <li className="flex items-start gap-3">
                  <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                  </svg>
                  <span className="text-sm text-gray-400">
                    P.O. Box 123, Accra, Ghana
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                  </svg>
                  <span className="text-sm text-gray-400">+233 XX XXX XXXX</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                  </svg>
                  <span className="text-sm text-gray-400">info@school.edu.gh</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-12 border-t border-gray-800 pt-8">
            <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
              <p className="text-xs text-gray-500">
                &copy; {currentYear} {schoolName}. All rights reserved.
              </p>
              <p className="text-xs text-gray-500">
                Powered by <span className="font-medium text-gray-400">SMS</span> &mdash; School Management System
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
