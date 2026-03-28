"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  getProgrammeSubjectsAction,
  assignSubjectToProgrammeAction,
  removeSubjectFromProgrammeAction,
} from "@/modules/academics/actions/subject.action";

// ─── Types ──────────────────────────────────────────────────────────

interface Programme {
  id: string;
  name: string;
}

interface SubjectOption {
  id: string;
  name: string;
  code: string | null;
  type: string;
}

interface ProgrammeSubjectItem {
  id: string;
  programmeId: string;
  subjectId: string;
  isCore: boolean;
  yearGroup: number | null;
  subjectName: string;
  subjectCode: string | null;
  subjectType: string;
  subjectStatus: string;
}

// ─── Component ──────────────────────────────────────────────────────

export function CurriculumClient({
  programmes,
  subjects,
}: {
  programmes: Programme[];
  subjects: SubjectOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [selectedProgrammeId, setSelectedProgrammeId] = useState<string>("");
  const [programmeSubjects, setProgrammeSubjects] = useState<ProgrammeSubjectItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Add subject dropdowns
  const [coreSubjectToAdd, setCoreSubjectToAdd] = useState<string>("");
  const [electiveSubjectToAdd, setElectiveSubjectToAdd] = useState<string>("");

  // Load programme subjects when selection changes
  useEffect(() => {
    if (!selectedProgrammeId) {
      const reset = () => setProgrammeSubjects([]);
      reset();
      return;
    }
    let cancelled = false;
    setLoading(true);
    getProgrammeSubjectsAction(selectedProgrammeId).then((result) => {
      if (cancelled) return;
      if (result.data) {
        setProgrammeSubjects(result.data);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedProgrammeId]);

  // Separate core and elective subjects
  const coreSubjects = programmeSubjects.filter((ps) => ps.isCore);
  const electiveSubjects = programmeSubjects.filter((ps) => !ps.isCore);

  // Get assigned subject IDs for filtering available subjects
  const assignedSubjectIds = new Set(programmeSubjects.map((ps) => ps.subjectId));

  // Available subjects not yet assigned
  const availableForCore = subjects.filter((s) => !assignedSubjectIds.has(s.id));
  const availableForElective = subjects.filter((s) => !assignedSubjectIds.has(s.id));

  function handleAddSubject(isCore: boolean) {
    const subjectId = isCore ? coreSubjectToAdd : electiveSubjectToAdd;
    if (!subjectId || !selectedProgrammeId) return;

    startTransition(async () => {
      const result = await assignSubjectToProgrammeAction({
        programmeId: selectedProgrammeId,
        subjectId,
        isCore,
      });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Subject assigned to programme.");
        // Refresh the programme subjects
        const refreshed = await getProgrammeSubjectsAction(selectedProgrammeId);
        if (refreshed.data) {
          setProgrammeSubjects(refreshed.data);
        }
        if (isCore) setCoreSubjectToAdd("");
        else setElectiveSubjectToAdd("");
        router.refresh();
      }
    });
  }

  function handleRemoveSubject(ps: ProgrammeSubjectItem) {
    if (!confirm(`Remove "${ps.subjectName}" from this programme?`)) return;

    startTransition(async () => {
      const result = await removeSubjectFromProgrammeAction(ps.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`"${ps.subjectName}" removed from programme.`);
        const refreshed = await getProgrammeSubjectsAction(selectedProgrammeId);
        if (refreshed.data) {
          setProgrammeSubjects(refreshed.data);
        }
        router.refresh();
      }
    });
  }

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <>
      {/* Programme Selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">Programme:</label>
        <select
          value={selectedProgrammeId}
          onChange={(e) => setSelectedProgrammeId(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm min-w-[250px]"
        >
          <option value="">Select a programme</option>
          {programmes.map((prog) => (
            <option key={prog.id} value={prog.id}>
              {prog.name}
            </option>
          ))}
        </select>
      </div>

      {!selectedProgrammeId ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
          Select a programme above to manage its subject assignments.
        </div>
      ) : loading ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
          Loading subjects...
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Core Subjects Column */}
          <div className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-4 py-3 bg-blue-50">
              <h3 className="text-sm font-semibold text-blue-800">
                Core Subjects ({coreSubjects.length})
              </h3>
            </div>
            <div className="p-4 space-y-2">
              {coreSubjects.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No core subjects assigned yet.</p>
              ) : (
                coreSubjects.map((ps) => (
                  <div
                    key={ps.id}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                  >
                    <div>
                      <span className="text-sm font-medium">{ps.subjectName}</span>
                      {ps.subjectCode && (
                        <span className="ml-2 text-xs text-muted-foreground font-mono">
                          ({ps.subjectCode})
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveSubject(ps)}
                      disabled={isPending}
                      className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}

              {/* Add Core Subject */}
              <div className="flex items-center gap-2 pt-3 border-t border-border mt-3">
                <select
                  value={coreSubjectToAdd}
                  onChange={(e) => setCoreSubjectToAdd(e.target.value)}
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Add a core subject...</option>
                  {availableForCore.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.code ? `(${s.code})` : ""}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => handleAddSubject(true)}
                  disabled={!coreSubjectToAdd || isPending}
                  className="rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Elective Subjects Column */}
          <div className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-4 py-3 bg-purple-50">
              <h3 className="text-sm font-semibold text-purple-800">
                Elective Subjects ({electiveSubjects.length})
              </h3>
            </div>
            <div className="p-4 space-y-2">
              {electiveSubjects.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  No elective subjects assigned yet.
                </p>
              ) : (
                electiveSubjects.map((ps) => (
                  <div
                    key={ps.id}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                  >
                    <div>
                      <span className="text-sm font-medium">{ps.subjectName}</span>
                      {ps.subjectCode && (
                        <span className="ml-2 text-xs text-muted-foreground font-mono">
                          ({ps.subjectCode})
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveSubject(ps)}
                      disabled={isPending}
                      className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}

              {/* Add Elective Subject */}
              <div className="flex items-center gap-2 pt-3 border-t border-border mt-3">
                <select
                  value={electiveSubjectToAdd}
                  onChange={(e) => setElectiveSubjectToAdd(e.target.value)}
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Add an elective subject...</option>
                  {availableForElective.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.code ? `(${s.code})` : ""}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => handleAddSubject(false)}
                  disabled={!electiveSubjectToAdd || isPending}
                  className="rounded-md bg-purple-600 px-3 py-2 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
