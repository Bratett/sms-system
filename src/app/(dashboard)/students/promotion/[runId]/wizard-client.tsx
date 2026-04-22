"use client";

import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import type { getPromotionRunAction } from "@/modules/student/actions/promotion.action";
import { Step1SourceReview } from "./step-1-source-review";
import { Step2OutcomesGrid } from "./step-2-outcomes-grid";
import { Step3DestinationPreview } from "./step-3-destination-preview";
import { Step4Commit } from "./step-4-commit";

// ─── Types ──────────────────────────────────────────────────────────
type RunResult = Awaited<ReturnType<typeof getPromotionRunAction>>;
type RunOk = Extract<RunResult, { data: unknown }>;
export type PromotionRun = RunOk["data"];

const STEP_LABELS = ["1. Source", "2. Outcomes", "3. Destinations", "4. Commit"] as const;

export function WizardClient({ run, step }: { run: PromotionRun; step: number }) {
  const router = useRouter();
  const goto = (n: number) => router.push(`/students/promotion/${run.id}?step=${n}`);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Promotion Wizard"
        description={`${run.sourceClassArm.class.name} — ${run.sourceClassArm.name} · ${run.sourceAcademicYear.name} → ${run.targetAcademicYear.name}`}
      />

      <nav className="sticky top-0 z-10 -mx-4 flex gap-2 border-b border-border bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:mx-0 sm:rounded-lg sm:border sm:px-3">
        {STEP_LABELS.map((label, idx) => {
          const n = idx + 1;
          const active = step === n;
          return (
            <button
              key={label}
              onClick={() => goto(n)}
              className={
                active
                  ? "rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
                  : "rounded-md bg-muted px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              }
            >
              {label}
            </button>
          );
        })}
      </nav>

      {step === 1 && <Step1SourceReview run={run} onNext={() => goto(2)} />}
      {step === 2 && (
        <Step2OutcomesGrid run={run} onNext={() => goto(3)} onBack={() => goto(1)} />
      )}
      {step === 3 && (
        <Step3DestinationPreview run={run} onNext={() => goto(4)} onBack={() => goto(2)} />
      )}
      {step === 4 && <Step4Commit run={run} onBack={() => goto(3)} />}
    </div>
  );
}
