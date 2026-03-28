"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition, useState } from "react";
import {
  updateSchoolSchema,
  type UpdateSchoolInput,
} from "@/modules/school/schemas/school.schema";
import { updateSchoolAction } from "@/modules/school/actions/school.action";
import { GHANA_REGIONS, SCHOOL_TYPES, SCHOOL_CATEGORIES } from "@/lib/constants";

const SCHOOL_TYPE_MAP: Record<string, string> = {
  day: "DAY",
  boarding: "BOARDING",
  "day-boarding": "DAY_BOARDING",
};

const SCHOOL_TYPE_LABELS: Record<string, string> = {
  DAY: "Day",
  BOARDING: "Boarding",
  DAY_BOARDING: "Day & Boarding",
};

const SCHOOL_CATEGORY_LABELS: Record<string, string> = {
  PUBLIC: "Public",
  PRIVATE: "Private",
};

interface SchoolSettingsFormProps {
  school: {
    id: string;
    name: string;
    motto: string | null;
    address: string | null;
    region: string | null;
    district: string | null;
    town: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    type: string;
    category: string;
    ghanaEducationServiceCode: string | null;
  } | null;
}

export function SchoolSettingsForm({ school }: SchoolSettingsFormProps) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateSchoolInput>({
    resolver: zodResolver(updateSchoolSchema),
    defaultValues: {
      name: school?.name ?? "",
      motto: school?.motto ?? "",
      address: school?.address ?? "",
      region: school?.region ?? "",
      district: school?.district ?? "",
      town: school?.town ?? "",
      phone: school?.phone ?? "",
      email: school?.email ?? "",
      website: school?.website ?? "",
      type: (school?.type as UpdateSchoolInput["type"]) ?? "DAY_BOARDING",
      category: (school?.category as UpdateSchoolInput["category"]) ?? "PUBLIC",
      ghanaEducationServiceCode: school?.ghanaEducationServiceCode ?? "",
    },
  });

  function onSubmit(data: UpdateSchoolInput) {
    setMessage(null);
    startTransition(async () => {
      const result = await updateSchoolAction(data);
      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({ type: "success", text: "School settings updated successfully." });
      }
    });
  }

  if (!school) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">
          No school record found. Please contact your system administrator to set up the school.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {message && (
        <div
          className={`rounded-md p-3 text-sm ${
            message.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4">Basic Information</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">School Name *</label>
            <input
              {...register("name")}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Enter school name"
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>
            )}
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Motto</label>
            <input
              {...register("motto")}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Enter school motto"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Type</label>
            <select
              {...register("type")}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {Object.entries(SCHOOL_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <select
              {...register("category")}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {Object.entries(SCHOOL_CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">GES Code</label>
            <input
              {...register("ghanaEducationServiceCode")}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Ghana Education Service code"
            />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4">Location</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Address</label>
            <input
              {...register("address")}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Street address"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Region</label>
            <select
              {...register("region")}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select region</option>
              {GHANA_REGIONS.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">District</label>
            <input
              {...register("district")}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="District"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Town</label>
            <input
              {...register("town")}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Town"
            />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4">Contact Information</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1">Phone</label>
            <input
              {...register("phone")}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Phone number"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              {...register("email")}
              type="email"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Email address"
            />
            {errors.email && (
              <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Website</label>
            <input
              {...register("website")}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="https://www.example.com"
            />
            {errors.website && (
              <p className="mt-1 text-xs text-red-500">{errors.website.message}</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
