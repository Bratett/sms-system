"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/permissions";
import { renderStudentIdCardAction } from "@/modules/student/actions/id-card.action";
import { renderReportCardPdfAction } from "@/modules/academics/actions/report-card.action";
import {
  renderTranscriptPdfAction,
  verifyTranscriptAction,
  issueTranscriptAction,
  generateTranscriptAction,
  getTranscriptsAction,
} from "@/modules/academics/actions/transcript.action";

type TranscriptRow = {
  id: string;
  transcriptNumber: string;
  coveringFrom: string | null;
  coveringTo: string | null;
  status: string;
};

type TermOption = { id: string; name: string; isCurrent?: boolean };

export function StudentAcademicSection({
  studentId,
  terms,
}: {
  studentId: string;
  terms: TermOption[];
}) {
  const { hasPermission } = usePermissions();
  const [transcripts, setTranscripts] = useState<TranscriptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, start] = useTransition();

  const canGenerateIdCard = hasPermission(PERMISSIONS.STUDENTS_ID_CARD_GENERATE);
  const canGenerateTranscript = hasPermission(PERMISSIONS.TRANSCRIPTS_CREATE);
  const canReadTranscript = hasPermission(PERMISSIONS.TRANSCRIPTS_READ);
  const canVerifyTranscript = hasPermission(PERMISSIONS.TRANSCRIPTS_VERIFY);
  const canIssueTranscript = hasPermission(PERMISSIONS.TRANSCRIPTS_ISSUE);
  const canGenerateReportCard = hasPermission(PERMISSIONS.REPORT_CARDS_GENERATE);

  async function loadTranscripts() {
    if (!canReadTranscript) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await getTranscriptsAction({ studentId });
    if ("data" in res) {
      setTranscripts(
        (res.data as TranscriptRow[]).map((t) => ({
          id: t.id,
          transcriptNumber: t.transcriptNumber,
          coveringFrom: t.coveringFrom,
          coveringTo: t.coveringTo,
          status: t.status,
        })),
      );
    }
    setLoading(false);
  }

  useEffect(() => {
    loadTranscripts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const openUrl = (url: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noreferrer";
    a.click();
  };

  const handleDownloadIdCard = () =>
    start(async () => {
      const res = await renderStudentIdCardAction(studentId);
      if ("error" in res) toast.error(res.error as string);
      else if ("data" in res && res.data) openUrl(res.data.url);
    });

  const handleGenerateTranscript = () =>
    start(async () => {
      const res = await generateTranscriptAction({ studentId });
      if ("error" in res) toast.error(res.error as string);
      else {
        toast.success("Transcript generated");
        await loadTranscripts();
      }
    });

  const handleVerify = (id: string) =>
    start(async () => {
      const res = await verifyTranscriptAction(id);
      if ("error" in res) toast.error(res.error as string);
      else {
        toast.success("Transcript verified");
        await loadTranscripts();
      }
    });

  const handleIssue = (id: string) =>
    start(async () => {
      if (!confirm("Issue this transcript? Once issued, it's frozen.")) return;
      const res = await issueTranscriptAction(id);
      if ("error" in res) toast.error(res.error as string);
      else {
        toast.success("Transcript issued");
        await loadTranscripts();
      }
    });

  const handleDownloadTranscript = (id: string) =>
    start(async () => {
      const res = await renderTranscriptPdfAction(id);
      if ("error" in res) toast.error(res.error as string);
      else if ("data" in res && res.data) openUrl(res.data.url);
    });

  return (
    <div className="space-y-4">
      {/* ID Card */}
      <div className="rounded-xl border border-border p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">Student ID Card</h3>
            <p className="text-sm text-muted-foreground">
              Print-ready card with QR code.
            </p>
          </div>
          {canGenerateIdCard ? (
            <button
              type="button"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              onClick={handleDownloadIdCard}
              disabled={pending}
            >
              Download ID Card
            </button>
          ) : null}
        </div>
      </div>

      {/* Transcripts */}
      <div className="rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Transcripts</h3>
          {canGenerateTranscript ? (
            <button
              type="button"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              onClick={handleGenerateTranscript}
              disabled={pending}
            >
              Generate new
            </button>
          ) : null}
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading transcripts…</p>
        ) : !canReadTranscript ? (
          <p className="text-sm text-muted-foreground">
            You don&apos;t have permission to view transcripts.
          </p>
        ) : transcripts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No transcripts yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2">Number</th>
                  <th className="py-2">Period</th>
                  <th className="py-2">Status</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {transcripts.map((t) => (
                  <tr key={t.id} className="border-t border-border">
                    <td className="py-2 font-mono text-xs">{t.transcriptNumber}</td>
                    <td className="py-2">
                      {t.coveringFrom ?? "-"} to {t.coveringTo ?? "-"}
                    </td>
                    <td className="py-2">
                      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs">
                        {t.status}
                      </span>
                    </td>
                    <td className="py-2 text-right space-x-3 whitespace-nowrap">
                      <button
                        type="button"
                        className="text-blue-600 hover:underline disabled:opacity-50"
                        onClick={() => handleDownloadTranscript(t.id)}
                        disabled={pending}
                      >
                        View PDF
                      </button>
                      {t.status === "GENERATED" && canVerifyTranscript ? (
                        <button
                          type="button"
                          className="text-emerald-600 hover:underline disabled:opacity-50"
                          onClick={() => handleVerify(t.id)}
                          disabled={pending}
                        >
                          Verify
                        </button>
                      ) : null}
                      {t.status === "VERIFIED" && canIssueTranscript ? (
                        <button
                          type="button"
                          className="text-amber-600 hover:underline disabled:opacity-50"
                          onClick={() => handleIssue(t.id)}
                          disabled={pending}
                        >
                          Issue
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Report Cards */}
      {canGenerateReportCard ? (
        <ReportCardsBlock studentId={studentId} terms={terms} />
      ) : null}
    </div>
  );
}

function ReportCardsBlock({
  studentId,
  terms,
}: {
  studentId: string;
  terms: TermOption[];
}) {
  const [pending, start] = useTransition();
  const [selectedTerm, setSelectedTerm] = useState<string>(
    terms.find((t) => t.isCurrent)?.id ?? "",
  );

  const openUrl = (url: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noreferrer";
    a.click();
  };

  const handleDownload = () => {
    if (!selectedTerm) return;
    start(async () => {
      const res = await renderReportCardPdfAction({
        studentId,
        termId: selectedTerm,
      });
      if ("error" in res) toast.error(res.error as string);
      else if ("data" in res && res.data) openUrl(res.data.url);
    });
  };

  return (
    <div className="rounded-xl border border-border p-4">
      <h3 className="font-semibold">Report Cards</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Pick a term to download the student&apos;s report card.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
          value={selectedTerm}
          onChange={(e) => setSelectedTerm(e.target.value)}
        >
          <option value="">Select term</option>
          {terms.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
              {t.isCurrent ? " (Current)" : ""}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          onClick={handleDownload}
          disabled={!selectedTerm || pending}
        >
          Download Report Card
        </button>
      </div>
      {terms.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          No terms available for this school yet.
        </p>
      ) : null}
    </div>
  );
}
