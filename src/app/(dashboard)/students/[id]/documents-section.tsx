"use client";

import { Fragment, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  listStudentDocumentsAction,
  getMissingRequiredDocumentsAction,
  listDocumentTypesAction,
  verifyStudentDocumentAction,
  rejectStudentDocumentAction,
  deleteStudentDocumentAction,
  recordUploadedStudentDocumentAction,
} from "@/modules/student/actions/document.action";

// ─── Types (derived from action return shapes) ──────────────────────
type StudentDocumentRow = Extract<
  Awaited<ReturnType<typeof listStudentDocumentsAction>>,
  { data: unknown }
>["data"][number];

type DocumentTypeRow = Extract<
  Awaited<ReturnType<typeof listDocumentTypesAction>>,
  { data: unknown }
>["data"][number];

type MissingResult = Extract<
  Awaited<ReturnType<typeof getMissingRequiredDocumentsAction>>,
  { data: unknown }
>["data"];

// ─── Helpers ────────────────────────────────────────────────────────

function formatDate(d: Date | string | null | undefined) {
  if (!d) return "---";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(d: Date | string | null | undefined) {
  if (!d) return "---";
  return new Date(d).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusPill({ doc }: { doc: StudentDocumentRow }) {
  const base =
    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium";

  if (doc.verificationStatus === "PENDING") {
    return <span className={`${base} bg-muted text-muted-foreground`}>Pending</span>;
  }
  if (doc.verificationStatus === "REJECTED") {
    return <span className={`${base} bg-red-100 text-red-800`}>Rejected</span>;
  }
  // VERIFIED — may be expired / expiring soon
  if (doc.isExpired) {
    return (
      <span className={`${base} bg-red-50 text-red-700 border border-red-200`}>
        Expired
      </span>
    );
  }
  if (doc.isExpiringSoon) {
    return (
      <span className={`${base} bg-amber-100 text-amber-800`}>Expiring soon</span>
    );
  }
  return <span className={`${base} bg-emerald-100 text-emerald-800`}>Verified</span>;
}

// ─── Component ──────────────────────────────────────────────────────

export function StudentDocumentsSection({ studentId }: { studentId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<StudentDocumentRow[]>([]);
  const [missing, setMissing] = useState<MissingResult["missing"]>([]);
  const [types, setTypes] = useState<DocumentTypeRow[]>([]);
  const [rowPending, setRowPending] = useTransition();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Upload form state
  const [uploadTypeId, setUploadTypeId] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadNotes, setUploadNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [listRes, missingRes, typesRes] = await Promise.all([
        listStudentDocumentsAction(studentId),
        getMissingRequiredDocumentsAction(studentId),
        listDocumentTypesAction({ status: "ACTIVE" }),
      ]);

      if ("error" in listRes) {
        setError(listRes.error as string);
        setLoading(false);
        return;
      }
      if ("error" in missingRes) {
        setError(missingRes.error as string);
        setLoading(false);
        return;
      }
      if ("error" in typesRes) {
        setError(typesRes.error as string);
        setLoading(false);
        return;
      }

      setDocuments(listRes.data ?? []);
      setMissing(missingRes.data?.missing ?? []);
      setTypes(typesRes.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const [listRes, missingRes, typesRes] = await Promise.all([
        listStudentDocumentsAction(studentId),
        getMissingRequiredDocumentsAction(studentId),
        listDocumentTypesAction({ status: "ACTIVE" }),
      ]);
      if (cancelled) return;

      if ("error" in listRes) {
        setError(listRes.error as string);
        setLoading(false);
        return;
      }
      if ("error" in missingRes) {
        setError(missingRes.error as string);
        setLoading(false);
        return;
      }
      if ("error" in typesRes) {
        setError(typesRes.error as string);
        setLoading(false);
        return;
      }

      setDocuments(listRes.data ?? []);
      setMissing(missingRes.data?.missing ?? []);
      setTypes(typesRes.data ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  // ─── Row actions ────────────────────────────────────────────────

  function handleView(fileKey: string) {
    const encoded = encodeURIComponent(fileKey);
    window.open(`/api/files/${encoded}`, "_blank", "noopener,noreferrer");
  }

  function handleVerify(id: string) {
    setRowPending(async () => {
      const res = await verifyStudentDocumentAction(id);
      if ("error" in res) {
        toast.error(res.error as string);
      } else {
        toast.success("Document verified.");
        await loadAll();
        router.refresh();
      }
    });
  }

  function handleReject(id: string) {
    const reason = rejectReason.trim();
    if (!reason) {
      toast.error("Please provide a rejection reason.");
      return;
    }
    setRowPending(async () => {
      const res = await rejectStudentDocumentAction({ id, reason });
      if ("error" in res) {
        toast.error(res.error as string);
      } else {
        toast.success("Document rejected.");
        setRejectingId(null);
        setRejectReason("");
        await loadAll();
        router.refresh();
      }
    });
  }

  function handleDelete(id: string, title: string) {
    if (!confirm(`Delete document "${title}"? This cannot be undone.`)) return;
    setRowPending(async () => {
      const res = await deleteStudentDocumentAction(id);
      if ("error" in res) {
        toast.error(res.error as string);
      } else {
        toast.success("Document deleted.");
        await loadAll();
        router.refresh();
      }
    });
  }

  // ─── Upload ─────────────────────────────────────────────────────

  function handleTypeChange(id: string) {
    setUploadTypeId(id);
    const t = types.find((tt) => tt.id === id);
    if (t) setUploadTitle(t.name);
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setUploadError(null);

    if (!uploadTypeId) {
      setUploadError("Please select a document type.");
      return;
    }
    if (!uploadFile) {
      setUploadError("Please choose a file to upload.");
      return;
    }
    if (!uploadTitle.trim()) {
      setUploadError("Title is required.");
      return;
    }

    setUploading(true);
    try {
      // Step 1: upload the file
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("module", "student-documents");
      formData.append("entityId", studentId);

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const body = (await uploadRes.json().catch(() => ({}))) as { error?: string };
        setUploadError(body.error ?? "File upload failed.");
        setUploading(false);
        return;
      }

      const uploadBody = (await uploadRes.json()) as {
        key: string;
        filename: string;
        size: number;
        contentType: string;
      };

      // Step 2: record the document row
      const recordRes = await recordUploadedStudentDocumentAction({
        studentId,
        documentTypeId: uploadTypeId,
        title: uploadTitle.trim(),
        fileKey: uploadBody.key,
        fileName: uploadBody.filename,
        fileSize: uploadBody.size,
        contentType: uploadBody.contentType,
        notes: uploadNotes.trim() || undefined,
      });

      if ("error" in recordRes) {
        setUploadError(recordRes.error as string);
        setUploading(false);
        return;
      }

      toast.success("Document uploaded.");
      // Reset form
      setUploadTypeId("");
      setUploadFile(null);
      setUploadTitle("");
      setUploadNotes("");
      const fileInput = document.getElementById(
        "student-doc-file-input",
      ) as HTMLInputElement | null;
      if (fileInput) fileInput.value = "";

      await loadAll();
      router.refresh();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  // ─── Render ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Loading documents…
      </div>
    );
  }
  if (error) {
    return (
      <div className="py-12 text-center text-sm text-red-600">Error: {error}</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Missing-required alert */}
      {missing.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <h3 className="font-semibold text-amber-900">Missing required documents</h3>
          <p className="mt-1 text-xs text-amber-800">
            The following required document types have not yet been uploaded and
            verified for this student.
          </p>
          <ul className="mt-2 space-y-1 text-sm text-amber-900">
            {missing.map((m) => (
              <li key={m.id} className="flex items-center gap-2">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-600" />
                {m.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Documents table */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Documents</h3>
        {documents.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            No documents uploaded yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-3 py-2 text-left font-medium">Type</th>
                  <th className="px-3 py-2 text-left font-medium">Title</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-left font-medium">Expiry</th>
                  <th className="px-3 py-2 text-left font-medium">Uploaded</th>
                  <th className="px-3 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((d) => (
                  <Fragment key={d.id}>
                    <tr className="border-b border-border/50 last:border-0">
                      <td className="px-3 py-2">{d.documentType?.name ?? "---"}</td>
                      <td className="px-3 py-2 font-medium">{d.title}</td>
                      <td className="px-3 py-2">
                        <StatusPill doc={d} />
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {d.expiresAt ? formatDate(d.expiresAt) : "No expiry"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground text-xs">
                        {formatDateTime(d.uploadedAt)}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleView(d.fileKey)}
                            className="text-xs text-primary hover:underline font-medium"
                          >
                            View
                          </button>
                          {d.verificationStatus === "PENDING" && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleVerify(d.id)}
                                disabled={rowPending}
                                className="text-xs text-emerald-700 hover:text-emerald-900 font-medium disabled:opacity-50"
                              >
                                Verify
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setRejectingId(d.id);
                                  setRejectReason("");
                                }}
                                disabled={rowPending}
                                className="text-xs text-amber-700 hover:text-amber-900 font-medium disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDelete(d.id, d.title)}
                            disabled={rowPending}
                            className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                    {d.verificationStatus === "REJECTED" && d.rejectionReason && (
                      <tr className="border-b border-border/50 last:border-0">
                        <td
                          colSpan={6}
                          className="px-3 pb-2 text-xs text-muted-foreground"
                        >
                          <span className="font-medium text-red-700">
                            Rejection reason:
                          </span>{" "}
                          {d.rejectionReason}
                        </td>
                      </tr>
                    )}
                    {rejectingId === d.id && (
                      <tr className="border-b border-border/50 last:border-0 bg-muted/40">
                        <td colSpan={6} className="px-3 py-3">
                          <label className="block text-xs font-medium mb-1">
                            Reason for rejecting &quot;{d.title}&quot;
                          </label>
                          <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            rows={2}
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            placeholder="e.g. Document is illegible, wrong file type, expired original..."
                          />
                          <div className="mt-2 flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setRejectingId(null);
                                setRejectReason("");
                              }}
                              className="rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-muted"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReject(d.id)}
                              disabled={rowPending || !rejectReason.trim()}
                              className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                            >
                              {rowPending ? "Rejecting..." : "Confirm rejection"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Upload panel */}
      <div className="rounded-lg border border-border bg-muted/20 p-4">
        <h3 className="text-sm font-semibold mb-3">Upload document</h3>
        {uploadError && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {uploadError}
          </div>
        )}
        <form onSubmit={handleUpload} className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="block text-xs font-medium mb-1">
                Document type <span className="text-red-500">*</span>
              </label>
              <select
                value={uploadTypeId}
                onChange={(e) => handleTypeChange(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                required
              >
                <option value="">Select type</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.isRequired ? " *" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">
              File <span className="text-red-500">*</span>
            </label>
            <input
              id="student-doc-file-input"
              type="file"
              onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              required
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Max 10MB. PDFs and images work best.
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Notes (optional)</label>
            <textarea
              value={uploadNotes}
              onChange={(e) => setUploadNotes(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Anything the verifier should know..."
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={uploading}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {uploading ? "Uploading..." : "Upload document"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
