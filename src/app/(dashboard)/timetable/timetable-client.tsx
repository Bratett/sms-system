"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createTimetableSlotAction,
  deleteTimetableSlotAction,
} from "@/modules/timetable/actions/timetable.action";
import {
  autoGenerateTimetableAction,
  clearTimetableAction,
} from "@/modules/timetable/actions/auto-generate.action";

// ─── Types ──────────────────────────────────────────────────────────

interface TimetableSlot {
  id: string;
  dayOfWeek: number;
  subject: { id: string; name: string; code: string | null };
  teacher: { id: string; name: string };
  period: { id: string; name: string; startTime: string; endTime: string; order: number; type: string };
  room: { id: string; name: string; building: string | null } | null;
  classArm: { id: string; name: string; className: string; classId: string };
  term: { id: string; name: string };
  academicYear: { id: string; name: string };
}

interface PeriodRow {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  order: number;
  type: string;
  isActive: boolean;
}

interface RoomOption {
  id: string;
  name: string;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

// ─── Component ──────────────────────────────────────────────────────

export function TimetableClient({
  slots,
  periods,
  rooms,
  filters,
}: {
  slots: TimetableSlot[];
  periods: PeriodRow[];
  rooms: RoomOption[];
  filters: { classArmId?: string; teacherId?: string; roomId?: string; termId?: string };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Filters
  const [classArmId, setClassArmId] = useState(filters.classArmId ?? "");

  // Create form
  const [showForm, setShowForm] = useState(false);
  const [slotForm, setSlotForm] = useState({
    academicYearId: "",
    termId: "",
    classArmId: "",
    subjectId: "",
    teacherId: "",
    periodId: "",
    roomId: "",
    dayOfWeek: 1,
  });

  // Get unique class arms from slots for the filter
  const classArms = Array.from(
    new Map(slots.map((s) => [s.classArm.id, s.classArm])).values()
  );

  // Filter active lesson periods only for the grid
  const activePeriods = periods
    .filter((p) => p.isActive)
    .sort((a, b) => a.order - b.order);

  // Build a lookup: key = `${dayOfWeek}-${periodId}`
  const slotMap = new Map<string, TimetableSlot>();
  const filteredSlots = classArmId ? slots.filter((s) => s.classArm.id === classArmId) : slots;
  for (const slot of filteredSlots) {
    slotMap.set(`${slot.dayOfWeek}-${slot.period.id}`, slot);
  }

  // ─── Filter ─────────────────────────────────────────────────────

  function applyFilters() {
    const params = new URLSearchParams();
    if (classArmId) params.set("classArmId", classArmId);
    router.push(`/timetable?${params.toString()}`);
  }

  function clearFilters() {
    setClassArmId("");
    router.push("/timetable");
  }

  // ─── CRUD ───────────────────────────────────────────────────────

  function openSlotForm() {
    setSlotForm({
      academicYearId: "",
      termId: "",
      classArmId: "",
      subjectId: "",
      teacherId: "",
      periodId: "",
      roomId: "",
      dayOfWeek: 1,
    });
    setShowForm(true);
  }

  function handleSaveSlot() {
    if (!slotForm.classArmId || !slotForm.subjectId || !slotForm.teacherId || !slotForm.periodId) {
      toast.error("Please fill in all required fields.");
      return;
    }
    if (!slotForm.academicYearId || !slotForm.termId) {
      toast.error("Academic year and term are required.");
      return;
    }

    startTransition(async () => {
      const result = await createTimetableSlotAction({
        academicYearId: slotForm.academicYearId,
        termId: slotForm.termId,
        classArmId: slotForm.classArmId,
        subjectId: slotForm.subjectId,
        teacherId: slotForm.teacherId,
        periodId: slotForm.periodId,
        roomId: slotForm.roomId || undefined,
        dayOfWeek: slotForm.dayOfWeek,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Timetable slot created successfully.");
      setShowForm(false);
      router.refresh();
    });
  }

  function handleDeleteSlot(slot: TimetableSlot) {
    if (!confirm(`Delete ${slot.subject.name} on ${DAYS[slot.dayOfWeek - 1]} at ${slot.period.name}?`)) return;

    startTransition(async () => {
      const result = await deleteTimetableSlotAction(slot.id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Timetable slot deleted.");
      router.refresh();
    });
  }

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Class Arm</label>
          <select
            value={classArmId}
            onChange={(e) => setClassArmId(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="">All Class Arms</option>
            {classArms.map((ca) => (
              <option key={ca.id} value={ca.id}>
                {ca.className} {ca.name}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={applyFilters}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Filter
        </button>
        <button
          onClick={clearFilters}
          className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
        >
          Clear
        </button>
        <div className="ml-auto flex gap-2">
          {classArmId && (
            <button
              onClick={() => {
                if (!confirm("This will auto-generate a timetable for the selected class. Existing slots will be kept. Continue?")) return;
                startTransition(async () => {
                  const termId = slots[0]?.term?.id;
                  const academicYearId = slots[0]?.academicYear?.id;
                  if (!termId || !academicYearId) {
                    toast.error("Please ensure term and academic year context is available.");
                    return;
                  }
                  const result = await autoGenerateTimetableAction({
                    academicYearId,
                    termId,
                    classArmIds: [classArmId],
                  });
                  if ("error" in result) {
                    toast.error(result.error);
                  } else {
                    toast.success(`Auto-generated ${"data" in result ? result.data?.created ?? 0 : 0} slots. ${"data" in result ? result.data?.conflicts?.length ?? 0 : 0} conflict(s).`);
                    router.refresh();
                  }
                });
              }}
              disabled={isPending}
              className="rounded-md border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/20"
            >
              Auto Generate
            </button>
          )}
          <button
            onClick={openSlotForm}
            disabled={isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Add Slot
          </button>
        </div>
      </div>

      {/* Weekly Grid */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full divide-y">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Period</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Time</th>
              {DAYS.map((day) => (
                <th key={day} className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y bg-card">
            {activePeriods.map((period) => (
              <tr key={period.id}>
                <td className="px-4 py-3 text-sm font-medium whitespace-nowrap">
                  {period.name}
                  {period.type !== "LESSON" && (
                    <span className="ml-2 inline-flex rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400">
                      {period.type}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                  {period.startTime} - {period.endTime}
                </td>
                {DAYS.map((_, dayIndex) => {
                  const dayOfWeek = dayIndex + 1;
                  const slot = slotMap.get(`${dayOfWeek}-${period.id}`);
                  return (
                    <td key={dayIndex} className="px-2 py-2 text-sm">
                      {slot ? (
                        <div className="rounded-md border bg-primary/5 p-2 text-xs">
                          <div className="font-semibold">{slot.subject.name}</div>
                          <div className="text-muted-foreground">{slot.teacher.name}</div>
                          {slot.room && (
                            <div className="text-muted-foreground">{slot.room.name}</div>
                          )}
                          <button
                            onClick={() => handleDeleteSlot(slot)}
                            className="mt-1 text-xs text-red-600 hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <div className="p-2 text-xs text-muted-foreground">-</div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {activePeriods.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No periods configured. Add periods first.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create Slot Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-background p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">New Timetable Slot</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Academic Year ID *</label>
                <input
                  type="text"
                  value={slotForm.academicYearId}
                  onChange={(e) => setSlotForm({ ...slotForm, academicYearId: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Academic year ID"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Term ID *</label>
                <input
                  type="text"
                  value={slotForm.termId}
                  onChange={(e) => setSlotForm({ ...slotForm, termId: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Term ID"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Class Arm ID *</label>
                <input
                  type="text"
                  value={slotForm.classArmId}
                  onChange={(e) => setSlotForm({ ...slotForm, classArmId: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Class arm ID"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Subject ID *</label>
                <input
                  type="text"
                  value={slotForm.subjectId}
                  onChange={(e) => setSlotForm({ ...slotForm, subjectId: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Subject ID"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Teacher ID *</label>
                <input
                  type="text"
                  value={slotForm.teacherId}
                  onChange={(e) => setSlotForm({ ...slotForm, teacherId: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Teacher ID"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Period *</label>
                <select
                  value={slotForm.periodId}
                  onChange={(e) => setSlotForm({ ...slotForm, periodId: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="">Select period</option>
                  {periods.filter((p) => p.isActive).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.startTime}-{p.endTime})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Room</label>
                <select
                  value={slotForm.roomId}
                  onChange={(e) => setSlotForm({ ...slotForm, roomId: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="">No room</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Day of Week *</label>
                <select
                  value={slotForm.dayOfWeek}
                  onChange={(e) => setSlotForm({ ...slotForm, dayOfWeek: parseInt(e.target.value) })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                >
                  {DAYS.map((day, i) => (
                    <option key={i} value={i + 1}>{day}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowForm(false)}
                className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSlot}
                disabled={isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending ? "Saving..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
