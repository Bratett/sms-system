"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateComplianceSettingsAction } from "@/modules/school/actions/compliance-settings.action";

interface SchoolCompliance {
  id: string;
  name?: string;
  tin: string | null;
  ssnitEmployerNumber: string | null;
  getFundCode: string | null;
  graVatTin: string | null;
  ghanaEducationServiceCode: string | null;
}

const FIELDS: Array<{
  key: keyof Omit<SchoolCompliance, "id" | "name">;
  label: string;
  hint: string;
  placeholder: string;
}> = [
  {
    key: "ghanaEducationServiceCode",
    label: "GES School Code",
    hint: "Ghana Education Service registration number.",
    placeholder: "e.g. GAR/ACCRA/001",
  },
  {
    key: "tin",
    label: "Tax Identification Number (TIN)",
    hint: "Primary GRA TIN used on PAYE returns and official receipts.",
    placeholder: "e.g. C0001234567",
  },
  {
    key: "ssnitEmployerNumber",
    label: "SSNIT Employer Number",
    hint: "Tier 1 / Tier 2 contributions are filed under this employer ID.",
    placeholder: "e.g. EMP/12345",
  },
  {
    key: "getFundCode",
    label: "GETFund Code",
    hint: "Beneficiary code on GETFund disbursement reports.",
    placeholder: "e.g. GF-2026-A-0123",
  },
  {
    key: "graVatTin",
    label: "VAT TIN",
    hint: "Separate VAT registration, if the school is VAT-registered.",
    placeholder: "Optional",
  },
];

export function ComplianceSettingsClient({
  school,
}: {
  school: SchoolCompliance;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    ghanaEducationServiceCode: school.ghanaEducationServiceCode ?? "",
    tin: school.tin ?? "",
    ssnitEmployerNumber: school.ssnitEmployerNumber ?? "",
    getFundCode: school.getFundCode ?? "",
    graVatTin: school.graVatTin ?? "",
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await updateComplianceSettingsAction({
        ghanaEducationServiceCode: form.ghanaEducationServiceCode.trim() || null,
        tin: form.tin.trim() || null,
        ssnitEmployerNumber: form.ssnitEmployerNumber.trim() || null,
        getFundCode: form.getFundCode.trim() || null,
        graVatTin: form.graVatTin.trim() || null,
      });
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Statutory identifiers updated.");
        router.refresh();
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-2xl space-y-5 rounded border border-gray-200 bg-white p-6"
    >
      {FIELDS.map((f) => (
        <div key={f.key}>
          <label className="mb-1 block text-sm font-medium text-gray-900">
            {f.label}
          </label>
          <input
            type="text"
            value={form[f.key]}
            onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
            placeholder={f.placeholder}
            className="w-full rounded border border-gray-300 p-2 font-mono text-sm"
          />
          <p className="mt-1 text-xs text-gray-500">{f.hint}</p>
        </div>
      ))}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save identifiers"}
        </button>
      </div>
    </form>
  );
}
