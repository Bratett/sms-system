import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock, mockAuthenticatedUser } from "../../setup";
import { audit } from "@/lib/audit";
import {
  getMyAlumniProfileAction,
  updateMyAlumniProfileAction,
  getAlumniDirectoryAction,
  getPublicAlumniProfileAction,
} from "@/modules/alumni/actions/alumni-self.action";

const ALUMNI_PERMS = ["alumni:profile:update-own", "alumni:directory:read"];

const sampleStudent = {
  id: "s-1",
  firstName: "Kofi",
  lastName: "Asante",
  studentId: "STU-001",
  photoUrl: null,
  dateOfBirth: new Date("2005-03-01"),
};

const sampleProfile = {
  id: "ap-1",
  studentId: "s-1",
  schoolId: "default-school",
  graduationYear: 2026,
  email: "kofi@example.com",
  phone: "+233200000000",
  address: "Accra",
  currentEmployer: "Acme",
  currentPosition: "Engineer",
  industry: "Tech",
  highestEducation: "BSc CS",
  linkedinUrl: "https://linkedin.com/in/kofi",
  bio: "Software engineer.",
  isPublic: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("getMyAlumniProfileAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ALUMNI_PERMS });
    prismaMock.student.findFirst.mockReset();
    prismaMock.alumniProfile.findUnique.mockReset();
    prismaMock.graduationRecord.findFirst.mockReset();
  });

  it("rejects unauthorized", async () => {
    mockAuthenticatedUser({ permissions: [] });
    const res = await getMyAlumniProfileAction();
    expect(res).toEqual({ error: "Insufficient permissions" });
  });

  it("rejects non-graduated user", async () => {
    prismaMock.student.findFirst.mockResolvedValue(null as never);
    const res = await getMyAlumniProfileAction();
    expect(res).toEqual({ error: "Alumni access not available." });
  });

  it("returns profile + student + graduation record on happy path", async () => {
    prismaMock.student.findFirst.mockResolvedValue(sampleStudent as never);
    prismaMock.alumniProfile.findUnique.mockResolvedValue(sampleProfile as never);
    prismaMock.graduationRecord.findFirst.mockResolvedValue({
      certificateNumber: "CERT-001",
      honours: "Distinction",
      batch: { name: "Class of 2026", ceremonyDate: new Date("2026-06-15") },
    } as never);

    const res = await getMyAlumniProfileAction();
    if (!("data" in res)) throw new Error("expected data");
    expect(res.data.id).toBe("ap-1");
    expect(res.data.student.firstName).toBe("Kofi");
    expect(res.data.graduation?.certificateNumber).toBe("CERT-001");
  });

  it("returns null graduation when no CONFIRMED record exists", async () => {
    prismaMock.student.findFirst.mockResolvedValue(sampleStudent as never);
    prismaMock.alumniProfile.findUnique.mockResolvedValue(sampleProfile as never);
    prismaMock.graduationRecord.findFirst.mockResolvedValue(null as never);

    const res = await getMyAlumniProfileAction();
    if (!("data" in res)) throw new Error("expected data");
    expect(res.data.graduation).toBeNull();
  });
});

describe("updateMyAlumniProfileAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ALUMNI_PERMS });
    prismaMock.student.findFirst.mockReset();
    prismaMock.alumniProfile.findUnique.mockReset();
    prismaMock.alumniProfile.update.mockReset();
    vi.mocked(audit).mockClear();
  });

  it("rejects unauthorized", async () => {
    mockAuthenticatedUser({ permissions: [] });
    const res = await updateMyAlumniProfileAction({ bio: "new" });
    expect(res).toEqual({ error: "Insufficient permissions" });
  });

  it("rejects non-graduated user", async () => {
    prismaMock.student.findFirst.mockResolvedValue(null as never);
    const res = await updateMyAlumniProfileAction({ bio: "new" });
    expect(res).toEqual({ error: "Alumni access not available." });
  });

  it("rejects invalid email format", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "s-1" } as never);
    const res = await updateMyAlumniProfileAction({ email: "not-an-email" });
    expect("error" in res).toBe(true);
  });

  it("happy path updates only supplied fields and audits", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "s-1" } as never);
    prismaMock.alumniProfile.findUnique.mockResolvedValue(sampleProfile as never);
    prismaMock.alumniProfile.update.mockResolvedValue({
      ...sampleProfile,
      bio: "Updated bio.",
    } as never);

    const res = await updateMyAlumniProfileAction({ bio: "Updated bio." });
    expect(res).toEqual({ data: expect.objectContaining({ bio: "Updated bio." }) });
    expect(prismaMock.alumniProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { studentId: "s-1" },
        data: { bio: "Updated bio." },
      }),
    );
    expect(vi.mocked(audit)).toHaveBeenCalled();
  });

  it("does not write fields that were not in the input", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "s-1" } as never);
    prismaMock.alumniProfile.findUnique.mockResolvedValue(sampleProfile as never);
    prismaMock.alumniProfile.update.mockResolvedValue(sampleProfile as never);

    await updateMyAlumniProfileAction({ isPublic: true });
    const updateCall = prismaMock.alumniProfile.update.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(updateCall.data).toEqual({ isPublic: true });
    expect(updateCall.data).not.toHaveProperty("bio");
    expect(updateCall.data).not.toHaveProperty("email");
  });

  it("converts empty linkedinUrl to null", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "s-1" } as never);
    prismaMock.alumniProfile.findUnique.mockResolvedValue(sampleProfile as never);
    prismaMock.alumniProfile.update.mockResolvedValue(sampleProfile as never);

    await updateMyAlumniProfileAction({ linkedinUrl: "" });
    const updateCall = prismaMock.alumniProfile.update.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(updateCall.data.linkedinUrl).toBeNull();
  });
});

describe("getAlumniDirectoryAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ALUMNI_PERMS });
    prismaMock.student.findFirst.mockReset();
    prismaMock.student.findMany.mockReset();
    prismaMock.alumniProfile.findMany.mockReset();
    prismaMock.alumniProfile.count.mockReset();
  });

  it("rejects unauthorized", async () => {
    mockAuthenticatedUser({ permissions: [] });
    const res = await getAlumniDirectoryAction({});
    expect(res).toEqual({ error: "Insufficient permissions" });
  });

  it("rejects non-graduated user", async () => {
    prismaMock.student.findFirst.mockResolvedValue(null as never);
    const res = await getAlumniDirectoryAction({});
    expect(res).toEqual({ error: "Alumni access not available." });
  });

  it("excludes self + private + other-school profiles via where clause", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "self-id" } as never);
    prismaMock.alumniProfile.findMany.mockResolvedValue([] as never);
    prismaMock.alumniProfile.count.mockResolvedValue(0 as never);
    prismaMock.student.findMany.mockResolvedValue([] as never);

    await getAlumniDirectoryAction({});

    expect(prismaMock.alumniProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          schoolId: "default-school",
          isPublic: true,
          studentId: { not: "self-id" },
        }),
      }),
    );
  });

  it("happy path returns redacted shape (no email/phone/address)", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "self-id" } as never);
    prismaMock.alumniProfile.findMany.mockResolvedValue([
      {
        id: "ap-2",
        studentId: "s-2",
        graduationYear: 2025,
        currentEmployer: "Other Co",
        currentPosition: "PM",
        industry: "Tech",
        highestEducation: "BSc",
        linkedinUrl: null,
        bio: "Other alum.",
      },
    ] as never);
    prismaMock.alumniProfile.count.mockResolvedValue(1 as never);
    prismaMock.student.findMany.mockResolvedValue([
      { id: "s-2", firstName: "Akua", lastName: "Mensah", photoUrl: null },
    ] as never);

    const res = await getAlumniDirectoryAction({});
    if (!("data" in res)) throw new Error("expected data");
    expect(res.data[0]).toMatchObject({
      id: "ap-2",
      firstName: "Akua",
      lastName: "Mensah",
      currentEmployer: "Other Co",
    });
    expect(res.data[0]).not.toHaveProperty("email");
    expect(res.data[0]).not.toHaveProperty("phone");
    expect(res.data[0]).not.toHaveProperty("address");
  });

  it("applies graduationYear and industry filters", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "self-id" } as never);
    prismaMock.alumniProfile.findMany.mockResolvedValue([] as never);
    prismaMock.alumniProfile.count.mockResolvedValue(0 as never);
    prismaMock.student.findMany.mockResolvedValue([] as never);

    await getAlumniDirectoryAction({ graduationYear: 2025, industry: "tech" });

    expect(prismaMock.alumniProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          graduationYear: 2025,
          industry: { contains: "tech", mode: "insensitive" },
        }),
      }),
    );
  });
});

describe("getPublicAlumniProfileAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ALUMNI_PERMS });
    prismaMock.student.findFirst.mockReset();
    prismaMock.alumniProfile.findUnique.mockReset();
    prismaMock.student.findUnique.mockReset();
  });

  it("rejects unauthorized", async () => {
    mockAuthenticatedUser({ permissions: [] });
    const res = await getPublicAlumniProfileAction("s-2");
    expect(res).toEqual({ error: "Insufficient permissions" });
  });

  it("returns 404-shape for non-existent profile", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "self-id" } as never);
    prismaMock.alumniProfile.findUnique.mockResolvedValue(null as never);
    const res = await getPublicAlumniProfileAction("missing");
    expect(res).toEqual({ error: "Profile not found" });
  });

  it("returns 404-shape for private profile", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "self-id" } as never);
    prismaMock.alumniProfile.findUnique.mockResolvedValue({
      id: "ap-2",
      studentId: "s-2",
      schoolId: "default-school",
      graduationYear: 2025,
      isPublic: false,
      currentEmployer: null,
      currentPosition: null,
      industry: null,
      highestEducation: null,
      linkedinUrl: null,
      bio: null,
    } as never);
    const res = await getPublicAlumniProfileAction("s-2");
    expect(res).toEqual({ error: "Profile not found" });
  });

  it("returns 404-shape for other-school profile", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "self-id" } as never);
    prismaMock.alumniProfile.findUnique.mockResolvedValue({
      id: "ap-2",
      studentId: "s-2",
      schoolId: "OTHER-SCHOOL",
      graduationYear: 2025,
      isPublic: true,
      currentEmployer: null,
      currentPosition: null,
      industry: null,
      highestEducation: null,
      linkedinUrl: null,
      bio: null,
    } as never);
    const res = await getPublicAlumniProfileAction("s-2");
    expect(res).toEqual({ error: "Profile not found" });
  });

  it("happy path returns redacted public profile", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "self-id" } as never);
    prismaMock.alumniProfile.findUnique.mockResolvedValue({
      id: "ap-2",
      studentId: "s-2",
      schoolId: "default-school",
      graduationYear: 2025,
      isPublic: true,
      currentEmployer: "Co",
      currentPosition: "Role",
      industry: "Tech",
      highestEducation: null,
      linkedinUrl: null,
      bio: "Alum.",
    } as never);
    prismaMock.student.findUnique.mockResolvedValue({
      firstName: "Akua",
      lastName: "Mensah",
      photoUrl: null,
    } as never);

    const res = await getPublicAlumniProfileAction("s-2");
    if (!("data" in res)) throw new Error("expected data");
    expect(res.data.firstName).toBe("Akua");
    expect(res.data.currentEmployer).toBe("Co");
    expect(res.data).not.toHaveProperty("email");
    expect(res.data).not.toHaveProperty("phone");
    expect(res.data).not.toHaveProperty("address");
  });
});
