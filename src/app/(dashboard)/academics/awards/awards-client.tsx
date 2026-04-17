"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createAwardAction,
  deleteAwardAction,
  suggestAwardsAction,
} from "@/modules/academics/actions/awards.action";

const AWARD_TYPES = [
  "BEST_STUDENT",
  "BEST_IN_SUBJECT",
  "MOST_IMPROVED",
  "PERFECT_ATTENDANCE",
  "LEADERSHIP",
  "SPORTS_AWARD",
  "CUSTOM",
] as const;

type AwardType = (typeof AWARD_TYPES)[number];

const TYPE_BADGE_COLORS: Record<AwardType, string> = {
  BEST_STUDENT: "bg-amber-50 text-amber-700 border-amber-200",
  BEST_IN_SUBJECT: "bg-blue-50 text-blue-700 border-blue-200",
  MOST_IMPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PERFECT_ATTENDANCE: "bg-teal-50 text-teal-700 border-teal-200",
  LEADERSHIP: "bg-purple-50 text-purple-700 border-purple-200",
  SPORTS_AWARD: "bg-green-50 text-green-700 border-green-200",
  CUSTOM: "bg-gray-50 text-gray-700 border-gray-200",
};

interface FormData {
  studentId: string;
  type: AwardType;
  title: string;
  description: string;
  subjectId: string;
}

export function AwardsClient({
  initialAwards,
  classArms,
  terms,
  academicYears,
}: {
  initialAwards: any[];
  classArms: Array<{ id: string; name: string; className: string }>;
  terms: Array<{
    id: string;
    name: string;
    termNumber: number;
    academicYearId: string;
    academicYearName: string;
    isCurrent: boolean;
  }>;
  academicYears: Array<{ id: string; name: string; isCurrent: boolean }>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Filters
  const currentYear = academicYears.find((ay) => ay.isCurrent);
  const [selectedYearId, setSelectedYearId] = useState(currentYear?.id ?? "");
  const [selectedTermId, setSelectedTermId] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [suggestClassArmId, setSuggestClassArmId] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormData>({
    studentId: "",
    type: "BEST_STUDENT",
    title: "",
    description: "",
    subjectId: "",
  });

  const filteredTerms = terms.filter(
    (t) => t.academicYearId === selectedYearId
  );

  const filteredAwards = useMemo(() => {
    let result = initialAwards;
    if (filterType !== "all") {
      result = result.filter((a: any) => a.type === filterType);
    }
    return result;
  }, [initialAwards, filterType]);

  function handleCreate() {
    setFormData({
      studentId: "",
      type: "BEST_STUDENT",
      title: "",
      description: "",
      subjectId: "",
    });
    setShowModal(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createAwardAction({
        ...formData,
        termId: selectedTermId,
        academicYearId: selectedYearId,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Award created successfully");
      setShowModal(false);
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    setDeleteId(id);
  }

  function confirmDelete() {
    if (!deleteId) return;
    startTransition(async () => {
      const result = await deleteAwardAction(deleteId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Award deleted successfully");
      setDeleteId(null);
      router.refresh();
    });
  }

  function handleSuggestAwards() {
    if (!suggestClassArmId || !selectedTermId || !selectedYearId) {
      toast.error("Please select a class arm, term, and academic year.");
      return;
    }
    startTransition(async () => {
      const result = await suggestAwardsAction(
        suggestClassArmId,
        selectedTermId,
        selectedYearId
      );
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setSuggestions("data" in result ? result.data : []);
      setShowSuggestModal(true);
    });
  }

  function handleAcceptSuggestion(suggestion: any) {
    startTransition(async () => {
      const result = await createAwardAction({
        studentId: suggestion.studentId,
        type: suggestion.type,
        title: suggestion.title,
        description: suggestion.description ?? "",
        subjectId: suggestion.subjectId ?? "",
        termId: selectedTermId,
        academicYearId: selectedYearId,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(`Award "${suggestion.title}" accepted and created`);
      setSuggestions((prev) =>
        prev.filter((s) => s !== suggestion)
      );
      router.refresh();
    });
  }

  function formatLabel(val: string) {
    return val.replace(/_/g, " ");
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Awards</h1>
          <p className="text-sm text-muted-foreground">
            Manage student awards and recognitions.
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90"
        >
          Add Award
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Academic Year
          </label>
          <select
            value={selectedYearId}
            onChange={(e) => {
              setSelectedYearId(e.target.value);
              setSelectedTermId("");
            }}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Select Year</option>
            {academicYears.map((ay) => (
              <option key={ay.id} value={ay.id}>
                {ay.name} {ay.isCurrent ? "(Current)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Term
          </label>
          <select
            value={selectedTermId}
            onChange={(e) => setSelectedTermId(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Select Term</option>
            {filteredTerms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} {t.isCurrent ? "(Current)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Type
          </label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="all">All Types</option>
            {AWARD_TYPES.map((t) => (
              <option key={t} value={t}>
                {formatLabel(t)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Class Arm (for suggestions)
          </label>
          <select
            value={suggestClassArmId}
            onChange={(e) => setSuggestClassArmId(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Select Class Arm</option>
            {classArms.map((ca) => (
              <option key={ca.id} value={ca.id}>
                {ca.className} {ca.name}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleSuggestAwards}
          disabled={isPending || !suggestClassArmId || !selectedTermId}
          className="rounded-lg bg-amber-600 text-white px-4 py-2 text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
        >
          {isPending ? "Loading..." : "Suggest Awards"}
        </button>
      </div>

      {/* Table */}
      {filteredAwards.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
          No awards found. Create one or use the Suggest Awards feature.
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-6 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Student</th>
                  <th className="px-4 py-3 text-left font-medium">Type</th>
                  <th className="px-4 py-3 text-left font-medium">Title</th>
                  <th className="px-4 py-3 text-left font-medium">Subject</th>
                  <th className="px-4 py-3 text-left font-medium">Awarded Date</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAwards.map((award: any) => (
                  <tr
                    key={award.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 font-medium">
                      {award.studentName ?? award.studentId}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                          TYPE_BADGE_COLORS[award.type as AwardType] ??
                          TYPE_BADGE_COLORS.CUSTOM
                        }`}
                      >
                        {formatLabel(award.type)}
                      </span>
                    </td>
                    <td className="px-4 py-3">{award.title}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {award.subjectName ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {award.awardedDate
                        ? new Date(award.awardedDate).toLocaleDateString()
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(award.id)}
                        className="text-xs text-red-600 hover:text-red-800 font-medium"
                        disabled={isPending}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold">Delete Award</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Are you sure you want to delete this award? This action cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={isPending}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold">Create Award</h3>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Student ID
                </label>
                <input
                  type="text"
                  value={formData.studentId}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, studentId: e.target.value }))
                  }
                  placeholder="Enter student ID"
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Type
                </label>
                <select
                  value={formData.type}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      type: e.target.value as AwardType,
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                >
                  {AWARD_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {formatLabel(t)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Title
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="Award title"
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Optional description"
                  rows={2}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Subject (optional)
                </label>
                <input
                  type="text"
                  value={formData.subjectId}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      subjectId: e.target.value,
                    }))
                  }
                  placeholder="Subject ID (for Best in Subject)"
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
                  disabled={isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                >
                  {isPending ? "Creating..." : "Create Award"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Suggestions Modal */}
      {showSuggestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-card p-6 shadow-lg max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold">Suggested Awards</h3>
            {suggestions.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                No award suggestions available for the selected criteria.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {suggestions.map((s: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-lg border border-border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{s.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.studentName ?? s.studentId} -{" "}
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                            TYPE_BADGE_COLORS[s.type as AwardType] ??
                            TYPE_BADGE_COLORS.CUSTOM
                          }`}
                        >
                          {formatLabel(s.type)}
                        </span>
                      </p>
                    </div>
                    <button
                      onClick={() => handleAcceptSuggestion(s)}
                      disabled={isPending}
                      className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                    >
                      Accept
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowSuggestModal(false)}
                className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
