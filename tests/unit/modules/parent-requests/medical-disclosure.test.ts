import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock, mockAuthenticatedUser } from "../../setup";
import { audit } from "@/lib/audit";
import {
  submitMedicalDisclosureAction,
  withdrawMedicalDisclosureAction,
  approveMedicalDisclosureAction,
  rejectMedicalDisclosureAction,
  getPendingMedicalDisclosuresAction,
} from "@/modules/parent-requests/actions/medical-disclosure.action";
import {
  notifyMedicalDisclosureSubmitted,
  notifyMedicalDisclosureReviewed,
} from "@/modules/parent-requests/notifications";

vi.mock("@/modules/parent-requests/notifications", () => ({
  notifyMedicalDisclosureSubmitted: vi.fn().mockResolvedValue(undefined),
  notifyMedicalDisclosureReviewed: vi.fn().mockResolvedValue(undefined),
}));

const sampleStudent = {
  id: "s-1",
  schoolId: "default-school",
  firstName: "Kofi",
  lastName: "Asante",
  status: "ACTIVE",
  allergies: "",
  medicalConditions: "",
  guardians: [{ guardian: { userId: "test-user-id" } }],
};

describe("submitMedicalDisclosureAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ["parent_requests:medical:submit"] });
    vi.mocked(notifyMedicalDisclosureSubmitted).mockClear();
  });

  it("rejects non-guardian", async () => {
    prismaMock.student.findFirst.mockResolvedValue({
      ...sampleStudent,
      guardians: [{ guardian: { userId: "other" } }],
    } as never);

    const res = await submitMedicalDisclosureAction({
      studentId: "s-1",
      category: "ALLERGY",
      title: "Peanut",
      description: "anaphylaxis",
    });
    expect(res).toHaveProperty("error");
  });

  it("rejects empty title or description", async () => {
    prismaMock.student.findFirst.mockResolvedValue(sampleStudent as never);
    const res1 = await submitMedicalDisclosureAction({
      studentId: "s-1",
      category: "ALLERGY",
      title: "",
      description: "x",
    });
    expect(res1).toHaveProperty("error");
    const res2 = await submitMedicalDisclosureAction({
      studentId: "s-1",
      category: "ALLERGY",
      title: "x",
      description: "",
    });
    expect(res2).toHaveProperty("error");
  });

  it("urgent submission calls notify with isUrgent=true", async () => {
    prismaMock.student.findFirst.mockResolvedValue(sampleStudent as never);
    prismaMock.userRole.findMany.mockResolvedValue([
      { userId: "nurse-1" },
    ] as never);
    prismaMock.medicalDisclosure.create.mockResolvedValue({
      id: "d-1",
      schoolId: "default-school",
    } as never);

    await submitMedicalDisclosureAction({
      studentId: "s-1",
      category: "ALLERGY",
      title: "Peanut",
      description: "severe",
      isUrgent: true,
    });
    expect(vi.mocked(notifyMedicalDisclosureSubmitted)).toHaveBeenCalledWith(
      expect.objectContaining({ isUrgent: true }),
    );
  });

  it("routine submission calls notify with isUrgent=false", async () => {
    prismaMock.student.findFirst.mockResolvedValue(sampleStudent as never);
    prismaMock.userRole.findMany.mockResolvedValue([{ userId: "nurse-1" }] as never);
    prismaMock.medicalDisclosure.create.mockResolvedValue({
      id: "d-1",
      schoolId: "default-school",
    } as never);

    await submitMedicalDisclosureAction({
      studentId: "s-1",
      category: "CONDITION",
      title: "Asthma",
      description: "mild",
    });
    expect(vi.mocked(notifyMedicalDisclosureSubmitted)).toHaveBeenCalledWith(
      expect.objectContaining({ isUrgent: false }),
    );
  });
});

describe("withdrawMedicalDisclosureAction", () => {
  beforeEach(() => mockAuthenticatedUser({ permissions: ["parent_requests:medical:submit"] }));

  it("works on own PENDING rows", async () => {
    prismaMock.medicalDisclosure.findFirst.mockResolvedValue({
      id: "d-1",
      schoolId: "default-school",
      submittedByUserId: "test-user-id",
      status: "PENDING",
    } as never);
    prismaMock.medicalDisclosure.update.mockResolvedValue({} as never);

    const res = await withdrawMedicalDisclosureAction("d-1");
    expect(res).toEqual({ success: true });
  });
});

describe("approveMedicalDisclosureAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ["parent_requests:medical:review"] });
    vi.mocked(notifyMedicalDisclosureReviewed).mockClear();
    vi.mocked(audit).mockClear();
  });

  it("creates MedicalRecord + updates disclosure + audits", async () => {
    prismaMock.medicalDisclosure.findFirst.mockResolvedValue({
      id: "d-1",
      schoolId: "default-school",
      studentId: "s-1",
      submittedByUserId: "parent-1",
      status: "PENDING",
      category: "ALLERGY",
      title: "Peanut",
      description: "severe",
      attachmentKey: null,
      student: { id: "s-1", firstName: "Kofi", lastName: "Asante", allergies: "", medicalConditions: "" },
    } as never);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock));
    prismaMock.medicalRecord.create.mockResolvedValue({ id: "mr-1" } as never);
    prismaMock.medicalDisclosure.update.mockResolvedValue({} as never);
    prismaMock.student.update.mockResolvedValue({} as never);

    const res = await approveMedicalDisclosureAction({
      disclosureId: "d-1",
      syncToStudent: { allergies: "Peanut" },
    });
    expect(res).toEqual({ success: true, medicalRecordId: "mr-1" });
    expect(prismaMock.medicalRecord.create).toHaveBeenCalled();
    expect(prismaMock.medicalDisclosure.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "APPROVED",
          resultingMedicalRecordId: "mr-1",
        }),
      }),
    );
    expect(prismaMock.student.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ allergies: "Peanut" }),
      }),
    );
    expect(vi.mocked(audit)).toHaveBeenCalled();
    expect(vi.mocked(notifyMedicalDisclosureReviewed)).toHaveBeenCalled();
  });

  it("does not update student when syncToStudent omitted", async () => {
    prismaMock.medicalDisclosure.findFirst.mockResolvedValue({
      id: "d-1",
      schoolId: "default-school",
      studentId: "s-1",
      submittedByUserId: "parent-1",
      status: "PENDING",
      category: "MEDICATION",
      title: "X",
      description: "y",
      student: { id: "s-1", firstName: "K", lastName: "A", allergies: "", medicalConditions: "" },
    } as never);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock));
    prismaMock.medicalRecord.create.mockResolvedValue({ id: "mr-2" } as never);
    prismaMock.medicalDisclosure.update.mockResolvedValue({} as never);
    prismaMock.student.update.mockClear();

    await approveMedicalDisclosureAction({ disclosureId: "d-1" });
    expect(prismaMock.student.update).not.toHaveBeenCalled();
  });

  it("rejects if already reviewed", async () => {
    prismaMock.medicalDisclosure.findFirst.mockResolvedValue({
      id: "d-1",
      schoolId: "default-school",
      status: "APPROVED",
    } as never);

    const res = await approveMedicalDisclosureAction({ disclosureId: "d-1" });
    expect(res).toEqual({ error: "Already reviewed" });
  });
});

describe("rejectMedicalDisclosureAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ["parent_requests:medical:review"] });
    vi.mocked(notifyMedicalDisclosureReviewed).mockClear();
    vi.mocked(audit).mockClear();
  });

  it("requires non-empty review note", async () => {
    const res = await rejectMedicalDisclosureAction({ disclosureId: "d-1", reviewNote: "  " });
    expect((res as { error: string }).error).toMatch(/note/i);
  });

  it("updates status + audits + notifies", async () => {
    prismaMock.medicalDisclosure.findFirst.mockResolvedValue({
      id: "d-1",
      schoolId: "default-school",
      studentId: "s-1",
      submittedByUserId: "parent-1",
      status: "PENDING",
      student: { id: "s-1", firstName: "K", lastName: "A" },
    } as never);
    prismaMock.medicalDisclosure.update.mockResolvedValue({} as never);

    const res = await rejectMedicalDisclosureAction({
      disclosureId: "d-1",
      reviewNote: "Consult your doctor",
    });
    expect(res).toEqual({ success: true });
    expect(prismaMock.medicalDisclosure.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "REJECTED" }) }),
    );
    expect(vi.mocked(audit)).toHaveBeenCalled();
    expect(vi.mocked(notifyMedicalDisclosureReviewed)).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "REJECTED" }),
    );
  });
});

describe("getPendingMedicalDisclosuresAction", () => {
  beforeEach(() => mockAuthenticatedUser({ permissions: ["parent_requests:medical:review"] }));

  it("returns school-wide PENDING rows with urgent first", async () => {
    prismaMock.medicalDisclosure.findMany.mockResolvedValue([] as never);
    const res = await getPendingMedicalDisclosuresAction();
    if (!("data" in res)) throw new Error("expected data");
    expect(res.data).toEqual([]);
    expect(prismaMock.medicalDisclosure.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          schoolId: "default-school",
          status: "PENDING",
        }),
      }),
    );
  });
});
