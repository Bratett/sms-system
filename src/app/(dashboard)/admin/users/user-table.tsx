"use client";

import { useTransition, useState } from "react";
import { deleteUserAction } from "@/modules/auth/actions/user.action";
import { useRouter } from "next/navigation";

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

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  INACTIVE: "bg-gray-100 text-gray-800",
  SUSPENDED: "bg-red-100 text-red-800",
};

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
      if (result.error) {
        alert(result.error);
      }
      setDeletingId(null);
      router.refresh();
    });
  }

  function formatDate(date: Date | null) {
    if (!date) return "Never";
    return new Date(date).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">Username</th>
              <th className="px-4 py-3 text-left font-medium">Email</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Roles</th>
              <th className="px-4 py-3 text-left font-medium">Last Login</th>
              <th className="px-4 py-3 text-left font-medium">Created</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  No users found.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">
                    {user.firstName} {user.lastName}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{user.username}</td>
                  <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATUS_STYLES[user.status] || "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {user.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {user.roles.map((role) => (
                        <span
                          key={role.id}
                          className="inline-flex items-center rounded-full bg-blue-100 text-blue-800 px-2 py-0.5 text-xs font-medium"
                        >
                          {role.displayName}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(user.lastLoginAt)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(user.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        onClick={() => router.push(`/admin/users/${user.id}/edit`)}
                      >
                        Edit
                      </button>
                      <button
                        className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                        onClick={() => handleDelete(user.id, user.username)}
                        disabled={isPending && deletingId === user.id}
                      >
                        {isPending && deletingId === user.id ? "..." : "Deactivate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
