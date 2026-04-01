"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  getTeacherAvailabilityAction,
  setTeacherAvailabilityAction,
  getTeacherPreferenceAction,
  saveTeacherPreferenceAction,
} from "@/modules/timetable/actions/teacher-availability.action";

const DAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
];

interface TeacherOption {
  id: string;
  staffId: string;
  name: string;
}

interface PeriodOption {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  type: string;
  order: number;
}

interface TermOption {
  id: string;
  name: string;
  isCurrent: boolean;
  academicYearName: string;
}

interface AvailabilityEntry {
  dayOfWeek: number;
  periodId: string;
  isAvailable: boolean;
  reason: string;
}

export function TeacherAvailabilityClient({
  teachers,
  periods,
  terms,
}: {
  teachers: TeacherOption[];
  periods: PeriodOption[];
  terms: TermOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const currentTerm = terms.find((t) => t.isCurrent);
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [selectedTermId, setSelectedTermId] = useState(currentTerm?.id ?? "");
  const [grid, setGrid] = useState<Map<string, AvailabilityEntry>>(new Map());
  const [loaded, setLoaded] = useState(false);

  // Preferences
  const [maxPeriodsPerDay, setMaxPeriodsPerDay] = useState<number | "">("");
  const [maxConsecutive, setMaxConsecutive] = useState<number | "">("");
  const [prefNotes, setPrefNotes] = useState("");

  const lessonPeriods = periods.filter((p) => p.type === "LESSON").sort((a, b) => a.order - b.order);

  function cellKey(day: number, periodId: string) {
    return `${day}-${periodId}`;
  }

  function loadAvailability() {
    if (!selectedTeacherId || !selectedTermId) return;

    startTransition(async () => {
      const [availResult, prefResult] = await Promise.all([
        getTeacherAvailabilityAction(selectedTeacherId, selectedTermId),
        getTeacherPreferenceAction(selectedTeacherId, selectedTermId),
      ]);

      // Build grid — default all to available
      const newGrid = new Map<string, AvailabilityEntry>();
      for (const day of DAYS) {
        for (const period of lessonPeriods) {
          const key = cellKey(day.value, period.id);
          newGrid.set(key, {
            dayOfWeek: day.value,
            periodId: period.id,
            isAvailable: true,
            reason: "",
          });
        }
      }

      // Override with saved data
      if (availResult.data) {
        for (const entry of availResult.data) {
          const key = cellKey(entry.dayOfWeek, entry.periodId);
          if (newGrid.has(key)) {
            newGrid.set(key, {
              dayOfWeek: entry.dayOfWeek,
              periodId: entry.periodId,
              isAvailable: entry.isAvailable,
              reason: entry.reason ?? "",
            });
          }
        }
      }

      setGrid(newGrid);

      // Load preferences
      if (prefResult.data) {
        setMaxPeriodsPerDay(prefResult.data.maxPeriodsPerDay ?? "");
        setMaxConsecutive(prefResult.data.maxConsecutivePeriods ?? "");
        setPrefNotes(prefResult.data.notes ?? "");
      } else {
        setMaxPeriodsPerDay("");
        setMaxConsecutive("");
        setPrefNotes("");
      }

      setLoaded(true);
    });
  }

  function toggleCell(key: string) {
    setGrid((prev) => {
      const next = new Map(prev);
      const entry = next.get(key);
      if (entry) {
        next.set(key, { ...entry, isAvailable: !entry.isAvailable });
      }
      return next;
    });
  }

  function handleSave() {
    if (!selectedTeacherId || !selectedTermId) return;

    const entries = Array.from(grid.values());

    startTransition(async () => {
      const [availResult, prefResult] = await Promise.all([
        setTeacherAvailabilityAction({
          teacherId: selectedTeacherId,
          termId: selectedTermId,
          entries,
        }),
        saveTeacherPreferenceAction({
          teacherId: selectedTeacherId,
          termId: selectedTermId,
          maxPeriodsPerDay: maxPeriodsPerDay === "" ? undefined : Number(maxPeriodsPerDay),
          maxConsecutivePeriods: maxConsecutive === "" ? undefined : Number(maxConsecutive),
          notes: prefNotes || undefined,
        }),
      ]);

      if (availResult.error) toast.error(availResult.error);
      else if (prefResult.error) toast.error(prefResult.error);
      else toast.success(`Saved availability (${availResult.data?.updated} slots) and preferences.`);
    });
  }

  return (
    <>
      {/* Selectors */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Teacher</label>
          <select
            value={selectedTeacherId}
            onChange={(e) => {
              setSelectedTeacherId(e.target.value);
              setLoaded(false);
            }}
            className="rounded-md border px-3 py-2 text-sm min-w-[200px]"
          >
            <option value="">Select teacher</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Term</label>
          <select
            value={selectedTermId}
            onChange={(e) => {
              setSelectedTermId(e.target.value);
              setLoaded(false);
            }}
            className="rounded-md border px-3 py-2 text-sm min-w-[200px]"
          >
            <option value="">Select term</option>
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.academicYearName} - {t.name} {t.isCurrent ? "(Current)" : ""}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={loadAvailability}
          disabled={isPending || !selectedTeacherId || !selectedTermId}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? "Loading..." : "Load"}
        </button>
      </div>

      {loaded && (
        <>
          {/* Availability Grid */}
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="border-b bg-muted/50 px-4 py-3">
              <h3 className="font-semibold text-sm">
                Availability Grid
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  Click cells to toggle available / unavailable
                </span>
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Period</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Time</th>
                    {DAYS.map((day) => (
                      <th key={day.value} className="px-4 py-2 text-center text-xs font-medium text-muted-foreground">
                        {day.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lessonPeriods.map((period) => (
                    <tr key={period.id} className="border-b last:border-0">
                      <td className="px-4 py-2 text-sm font-medium whitespace-nowrap">{period.name}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                        {period.startTime}-{period.endTime}
                      </td>
                      {DAYS.map((day) => {
                        const key = cellKey(day.value, period.id);
                        const entry = grid.get(key);
                        const isAvailable = entry?.isAvailable ?? true;

                        return (
                          <td key={day.value} className="px-2 py-2 text-center">
                            <button
                              onClick={() => toggleCell(key)}
                              className={`h-10 w-14 rounded-md border-2 text-xs font-medium transition-all ${
                                isAvailable
                                  ? "border-green-300 bg-green-100 text-green-700 hover:bg-green-200"
                                  : "border-red-300 bg-red-100 text-red-700 hover:bg-red-200"
                              }`}
                            >
                              {isAvailable ? "Yes" : "No"}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Preferences */}
          <div className="rounded-lg border bg-card p-4">
            <h3 className="mb-3 font-semibold text-sm">Scheduling Preferences</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Max Periods Per Day
                </label>
                <input
                  type="number"
                  value={maxPeriodsPerDay}
                  onChange={(e) => setMaxPeriodsPerDay(e.target.value === "" ? "" : Number(e.target.value))}
                  min={1}
                  max={12}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="No limit"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Max Consecutive Periods
                </label>
                <input
                  type="number"
                  value={maxConsecutive}
                  onChange={(e) => setMaxConsecutive(e.target.value === "" ? "" : Number(e.target.value))}
                  min={1}
                  max={8}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="No limit"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Notes</label>
                <input
                  type="text"
                  value={prefNotes}
                  onChange={(e) => setPrefNotes(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="e.g. Prefers mornings"
                />
              </div>
            </div>
          </div>

          {/* Save */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={isPending}
              className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isPending ? "Saving..." : "Save Availability & Preferences"}
            </button>
          </div>
        </>
      )}

      {!loaded && selectedTeacherId && selectedTermId && (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          Click "Load" to view and edit availability.
        </div>
      )}
    </>
  );
}
