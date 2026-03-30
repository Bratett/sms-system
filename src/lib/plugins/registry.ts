import type { ModuleDefinition, SchoolModuleConfig } from "./types";

/**
 * Module registry - manages available modules and per-school configuration.
 */

const modules = new Map<string, ModuleDefinition>();

// ─── Built-in Module Definitions ────────────────────────────────────

const BUILT_IN_MODULES: ModuleDefinition[] = [
  // Core modules (cannot be disabled)
  {
    id: "dashboard",
    name: "Dashboard",
    description: "School overview and quick actions",
    category: "core",
    isCore: true,
    version: "1.0.0",
    permissions: [],
    navigation: { icon: "LayoutDashboard", path: "/dashboard", order: 0 },
  },
  {
    id: "students",
    name: "Student Management",
    description: "Student records, enrollment, and profiles",
    category: "core",
    isCore: true,
    version: "1.0.0",
    permissions: ["students:read"],
    navigation: { icon: "Users", path: "/students", order: 1 },
  },
  {
    id: "academics",
    name: "Academics",
    description: "Classes, subjects, assessments, and results",
    category: "academics",
    isCore: true,
    version: "1.0.0",
    permissions: ["academics:read"],
    navigation: { icon: "GraduationCap", path: "/academics", order: 2 },
  },
  {
    id: "admin",
    name: "Administration",
    description: "School settings, users, roles, and audit logs",
    category: "core",
    isCore: true,
    version: "1.0.0",
    permissions: ["school:settings:read"],
    navigation: { icon: "Settings", path: "/admin", order: 100 },
  },

  // Optional modules
  {
    id: "admissions",
    name: "Admissions",
    description: "Application processing and enrollment pipeline",
    category: "operations",
    isCore: false,
    version: "1.0.0",
    permissions: ["admissions:read"],
    navigation: { icon: "UserPlus", path: "/admissions", order: 3 },
  },
  {
    id: "attendance",
    name: "Attendance",
    description: "Daily and period-based attendance tracking",
    category: "academics",
    isCore: false,
    version: "1.0.0",
    permissions: ["attendance:read"],
    navigation: { icon: "ClipboardCheck", path: "/attendance", order: 4 },
  },
  {
    id: "finance",
    name: "Finance",
    description: "Fee structures, billing, payments, and receipts",
    category: "finance",
    isCore: false,
    version: "1.0.0",
    permissions: ["finance:read"],
    navigation: { icon: "Wallet", path: "/finance", order: 5 },
  },
  {
    id: "boarding",
    name: "Boarding",
    description: "Hostel management, bed allocation, exeat, and roll call",
    category: "operations",
    isCore: false,
    version: "1.0.0",
    permissions: ["boarding:read"],
    navigation: { icon: "Building2", path: "/boarding", order: 6 },
  },
  {
    id: "hr",
    name: "HR & Staff",
    description: "Staff records, leave management, and payroll",
    category: "operations",
    isCore: false,
    version: "1.0.0",
    permissions: ["hr:read"],
    navigation: { icon: "Briefcase", path: "/hr", order: 7 },
  },
  {
    id: "communication",
    name: "Communication",
    description: "SMS, WhatsApp, announcements, and notifications",
    category: "communication",
    isCore: false,
    version: "1.0.0",
    permissions: ["communication:read"],
    navigation: { icon: "MessageSquare", path: "/communication", order: 8 },
  },
  {
    id: "discipline",
    name: "Discipline",
    description: "Incident reporting, counseling, and welfare tracking",
    category: "operations",
    isCore: false,
    version: "1.0.0",
    permissions: ["discipline:read"],
    navigation: { icon: "Shield", path: "/discipline", order: 9 },
  },
  {
    id: "inventory",
    name: "Inventory",
    description: "Stock management, procurement, and supplier tracking",
    category: "operations",
    isCore: false,
    version: "1.0.0",
    permissions: ["inventory:read"],
    navigation: { icon: "Package", path: "/inventory", order: 10 },
  },
  {
    id: "graduation",
    name: "Graduation",
    description: "Graduation processing and alumni management",
    category: "academics",
    isCore: false,
    version: "1.0.0",
    permissions: ["graduation:read"],
    navigation: { icon: "Award", path: "/graduation", order: 11 },
  },
  {
    id: "reports",
    name: "Reports",
    description: "Academic, financial, and operational reports",
    category: "analytics",
    isCore: false,
    version: "1.0.0",
    permissions: ["reports:read"],
    navigation: { icon: "BarChart3", path: "/reports", order: 12 },
  },
  {
    id: "lms",
    name: "Learning Management",
    description: "Online courses, assignments, quizzes, and progress tracking",
    category: "academics",
    isCore: false,
    version: "1.0.0",
    permissions: ["academics:read"],
    navigation: { icon: "BookOpen", path: "/lms", order: 13 },
    dependencies: ["academics"],
  },
  {
    id: "ai-analytics",
    name: "AI Analytics",
    description: "Student risk profiling, performance predictions, and anomaly detection",
    category: "analytics",
    isCore: false,
    version: "1.0.0",
    permissions: ["reports:read"],
    navigation: { icon: "Brain", path: "/ai-analytics", order: 14 },
    dependencies: ["academics"],
  },
  {
    id: "library",
    name: "Library",
    description: "Book catalog, issue/return tracking, and digital resources",
    category: "operations",
    isCore: false,
    version: "1.0.0",
    permissions: [],
    navigation: { icon: "Library", path: "/library", order: 15 },
  },
  {
    id: "transport",
    name: "Transport",
    description: "Vehicle management, routes, and student transport assignments",
    category: "operations",
    isCore: false,
    version: "1.0.0",
    permissions: [],
    navigation: { icon: "Bus", path: "/transport", order: 16 },
  },
  {
    id: "curriculum",
    name: "Multi-Curriculum",
    description: "Manage multiple curriculum frameworks, grading templates, and standards",
    category: "academics",
    isCore: false,
    version: "1.0.0",
    permissions: ["school:settings:read"],
    navigation: { icon: "BookMarked", path: "/curriculum", order: 17 },
  },
];

// Register all built-in modules
for (const mod of BUILT_IN_MODULES) {
  modules.set(mod.id, mod);
}

// ─── Registry API ───────────────────────────────────────────────────

/**
 * Get all registered modules.
 */
export function getAllModules(): ModuleDefinition[] {
  return [...modules.values()];
}

/**
 * Get a module by ID.
 */
export function getModule(id: string): ModuleDefinition | undefined {
  return modules.get(id);
}

/**
 * Get enabled modules for a school based on its configuration.
 * Core modules are always included.
 */
export function getEnabledModules(schoolConfig: SchoolModuleConfig[]): ModuleDefinition[] {
  const enabledIds = new Set(
    schoolConfig.filter((c) => c.enabled).map((c) => c.moduleId),
  );

  return [...modules.values()].filter(
    (mod) => mod.isCore || enabledIds.has(mod.id),
  );
}

/**
 * Get the navigation items for enabled modules.
 */
export function getNavigationForModules(enabledModules: ModuleDefinition[]): Array<{
  id: string;
  name: string;
  icon: string;
  path: string;
  order: number;
  permissions: string[];
}> {
  return enabledModules
    .filter((mod) => mod.navigation)
    .map((mod) => ({
      id: mod.id,
      name: mod.name,
      icon: mod.navigation!.icon,
      path: mod.navigation!.path,
      order: mod.navigation!.order,
      permissions: mod.permissions,
    }))
    .sort((a, b) => a.order - b.order);
}

/**
 * Register a custom module (for plugin system).
 */
export function registerModule(definition: ModuleDefinition): void {
  modules.set(definition.id, definition);
}

/**
 * Check if a module's dependencies are satisfied.
 */
export function checkDependencies(
  moduleId: string,
  enabledIds: Set<string>,
): { satisfied: boolean; missing: string[] } {
  const mod = modules.get(moduleId);
  if (!mod?.dependencies) return { satisfied: true, missing: [] };

  const missing = mod.dependencies.filter((dep) => !enabledIds.has(dep));
  return { satisfied: missing.length === 0, missing };
}
