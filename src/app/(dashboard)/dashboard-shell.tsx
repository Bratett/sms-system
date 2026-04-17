"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

const SIDEBAR_COLLAPSED_KEY = "sms-sidebar-collapsed";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Restore sidebar preference from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (stored === "true") {
      setSidebarCollapsed(true);
    }
  }, []);

  const toggleSidebar = () => {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar collapsed={sidebarCollapsed} onToggleCollapse={toggleSidebar} />

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile sidebar */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-y-0 left-0 z-50 w-64 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          <Sidebar />
        </div>
      )}

      {/* Screen-reader live region for dynamic status updates */}
      <div aria-live="polite" aria-atomic="true" className="sr-only" id="sr-status" />

      <div
        className={`transition-all duration-200 ${sidebarCollapsed ? "lg:pl-16" : "lg:pl-64"}`}
      >
        <Topbar onMenuClick={() => setMobileMenuOpen(!mobileMenuOpen)} />
        <main id="main-content" className="p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
