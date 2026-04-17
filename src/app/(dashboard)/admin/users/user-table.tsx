"use client";

import { useTransition, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { deleteUserAction } from "@/modules/auth/actions/user.action";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";

interface UserRow {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  status: string;
  lastLoginAt: Date | null;
  createdAt: Date;
  roles: { id: string; name: string; displayName: string }[];
}

function formatDate(date: Date | null) {
  if (!date) return "Never";
  return new Date(date).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function UserTable({ users }: { users: UserRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleDelete(id: string, username: string) {
    if (!confirm(`Are you sure you want to deactivate user "${username}"?`)) {
      return;
    }
    setDeletingId(id);
    startTransition(async () => {
      const result = await deleteUserAction(id);
      if ("error" in result) {
        alert(result.error);
      }
      setDeletingId(null);
      router.refresh();
    });
  }

  const columns: ColumnDef<UserRow, unknown>[] = [
    {
      accessorFn: (row) => `${row.firstName} ${row.lastName}`,
      id: "name",
      header: "Name",
      cell: ({ row }) => (
        <span className="font-medium">
          {row.original.firstName} {row.original.lastName}
        </span>
      ),
    },
    {
      accessorKey: "username",
      header: "Username",
      cell: ({ getValue }) => (
        <span className="text-muted-foreground">{getValue<string>()}</span>
      ),
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ getValue }) => (
        <span className="text-muted-foreground">{getValue<string>()}</span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ getValue }) => <StatusBadge status={getValue<string>()} />,
    },
    {
      id: "roles",
      header: "Roles",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.roles.map((role) => (
            <span
              key={role.id}
              className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"
            >
              {role.displayName}
            </span>
          ))}
        </div>
      ),
    },
    {
      accessorKey: "lastLoginAt",
      header: "Last Login",
      cell: ({ getValue }) => (
        <span className="text-muted-foreground">{formatDate(getValue<Date | null>())}</span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ getValue }) => (
        <span className="text-muted-foreground">{formatDate(getValue<Date>())}</span>
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => {
        const user = row.original;
        return (
          <div className="flex items-center justify-end gap-2">
            <button
              className="text-xs font-medium text-primary hover:text-primary/80"
              onClick={() => router.push(`/admin/users/${user.id}/edit`)}
            >
              Edit
            </button>
            <button
              className="text-xs font-medium text-destructive hover:text-destructive/80 disabled:opacity-50"
              onClick={() => handleDelete(user.id, user.username)}
              disabled={isPending && deletingId === user.id}
            >
              {isPending && deletingId === user.id ? "..." : "Deactivate"}
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={users}
      searchKey="name"
      searchPlaceholder="Search users..."
      emptyMessage="No users found."
    />
  );
}
