"use client";

import { type ReactNode } from "react";

/**
 * Standard layout wrapper for CRUD list pages.
 * Provides consistent structure: header with title + action button,
 * filter bar, data table area, and dialog slot.
 *
 * Usage:
 * ```tsx
 * <CrudPageLayout
 *   title="Students"
 *   description="Manage student records"
 *   createButton={<Button onClick={() => setOpen(true)}>Add Student</Button>}
 *   filters={<FilterBar ... />}
 *   dialog={<CreateStudentDialog ... />}
 * >
 *   <DataTable columns={columns} data={students} />
 * </CrudPageLayout>
 * ```
 */
export function CrudPageLayout({
  title,
  description,
  createButton,
  filters,
  children,
  dialog,
}: {
  title: string;
  description?: string;
  createButton?: ReactNode;
  filters?: ReactNode;
  children: ReactNode;
  dialog?: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {createButton}
      </div>

      {filters && <div className="flex flex-wrap gap-3">{filters}</div>}

      {children}

      {dialog}
    </div>
  );
}
