"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  updateHouseholdAction,
  deleteHouseholdAction,
  moveGuardianToHouseholdAction,
  moveStudentToHouseholdAction,
} from "@/modules/student/actions/household.action";

type HouseholdDetail = {
  id: string;
  name: string;
  address: string | null;
  notes: string | null;
  guardians: Array<{
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    relationship: string | null;
  }>;
  students: Array<{
    id: string;
    studentId: string;
    firstName: string;
    lastName: string;
    status: string;
  }>;
};

export function HouseholdDetailClient({ household }: { household: HouseholdDetail }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState(household.name);
  const [address, setAddress] = useState(household.address ?? "");
  const [notes, setNotes] = useState(household.notes ?? "");

  const onSave = () => {
    start(async () => {
      const res = await updateHouseholdAction(household.id, { name, address, notes });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Household updated");
      router.refresh();
    });
  };

  const onDelete = () => {
    if (household.guardians.length > 0 || household.students.length > 0) {
      toast.error("Remove all members before deleting");
      return;
    }
    if (!confirm("Delete this household?")) return;
    start(async () => {
      const res = await deleteHouseholdAction(household.id);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Household deleted");
      router.push("/students/households");
    });
  };

  const onRemoveGuardian = (guardianId: string) => {
    if (!confirm("Remove this guardian from the household?")) return;
    start(async () => {
      const res = await moveGuardianToHouseholdAction(guardianId, null);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Guardian removed");
      router.refresh();
    });
  };

  const onRemoveStudent = (studentId: string) => {
    if (!confirm("Remove this student from the household?")) return;
    start(async () => {
      const res = await moveStudentToHouseholdAction(studentId, null);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Student removed");
      router.refresh();
    });
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <Link href="/students/households" className="text-sm text-muted-foreground hover:underline">
          ← Households
        </Link>
        <button
          onClick={onDelete}
          disabled={pending}
          className="text-sm text-red-600 hover:underline disabled:opacity-50"
        >
          Delete household
        </button>
      </div>

      <div className="rounded-xl border border-border p-4 space-y-3">
        <h1 className="text-lg font-semibold">Household details</h1>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
        />
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Address"
          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
        />
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes"
          rows={3}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
        />
        <button
          onClick={onSave}
          disabled={pending}
          className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
        >
          Save
        </button>
      </div>

      <div className="rounded-xl border border-border p-4">
        <h2 className="font-semibold mb-3">Guardians ({household.guardians.length})</h2>
        {household.guardians.length === 0 ? (
          <p className="text-sm text-muted-foreground">No guardians in this household.</p>
        ) : (
          <ul className="space-y-2">
            {household.guardians.map((g) => (
              <li key={g.id} className="flex items-center justify-between border-b border-border pb-2">
                <div>
                  <p className="text-sm font-medium">
                    {g.firstName} {g.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {g.phone}
                    {g.relationship ? ` • ${g.relationship}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => onRemoveGuardian(g.id)}
                  disabled={pending}
                  className="text-xs text-red-600 hover:underline disabled:opacity-50"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-border p-4">
        <h2 className="font-semibold mb-3">Students ({household.students.length})</h2>
        {household.students.length === 0 ? (
          <p className="text-sm text-muted-foreground">No students in this household.</p>
        ) : (
          <ul className="space-y-2">
            {household.students.map((s) => (
              <li key={s.id} className="flex items-center justify-between border-b border-border pb-2">
                <div>
                  <Link href={`/students/${s.id}`} className="text-sm font-medium hover:underline">
                    {s.firstName} {s.lastName}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {s.studentId} • {s.status}
                  </p>
                </div>
                <button
                  onClick={() => onRemoveStudent(s.id)}
                  disabled={pending}
                  className="text-xs text-red-600 hover:underline disabled:opacity-50"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
