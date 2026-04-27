import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser } from "../../setup";
import { getAlumniDashboardAction } from "@/modules/alumni/actions/alumni-admin.action";

const ADMIN_PERMS = ["graduation:records:read"];

describe("getAlumniDashboardAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ADMIN_PERMS });
    prismaMock.alumniProfile.findMany.mockReset();
    prismaMock.alumniProfile.count.mockReset();
    prismaMock.student.findMany.mockReset();
  });

  it("rejects unauthorized", async () => {
    mockAuthenticatedUser({ permissions: [] });
    const res = await getAlumniDashboardAction({});
    expect(res).toEqual({ error: "Insufficient permissions" });
  });

  it("happy path returns rows + pagination + aggregates", async () => {
    const profile1 = {
      id: "ap-1",
      studentId: "s-1",
      schoolId: "default-school",
      graduationYear: 2026,
      email: "a@x.com",
      phone: "+233...",
      address: null,
      currentEmployer: "Acme",
      currentPosition: "Eng",
      industry: "Tech",
      highestEducation: "BSc",
      linkedinUrl: null,
      bio: "Bio",
      isPublic: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const profile2 = {
      ...profile1,
      id: "ap-2",
      studentId: "s-2",
      graduationYear: 2025,
      industry: "Finance",
      isPublic: false,
      bio: null,
      currentEmployer: null,
    };

    prismaMock.alumniProfile.findMany
      // First call: paginated rows
      .mockResolvedValueOnce([profile1, profile2] as never)
      // Second call: aggregate corpus
      .mockResolvedValueOnce([
        { graduationYear: 2026, industry: "Tech", isPublic: true, studentId: "s-1" },
        { graduationYear: 2025, industry: "Finance", isPublic: false, studentId: "s-2" },
      ] as never);
    prismaMock.alumniProfile.count.mockResolvedValue(2 as never);
    prismaMock.student.findMany
      // Page hydration
      .mockResolvedValueOnce([
        { id: "s-1", firstName: "Kofi", lastName: "Asante", studentId: "STU-001", photoUrl: null, userId: "u-1" },
        { id: "s-2", firstName: "Akua", lastName: "Mensah", studentId: "STU-002", photoUrl: null, userId: null },
      ] as never)
      // Aggregate userId resolution
      .mockResolvedValueOnce([
        { id: "s-1", userId: "u-1" },
        { id: "s-2", userId: null },
      ] as never);

    const res = await getAlumniDashboardAction({});
    if (!("data" in res)) throw new Error("expected data");
    expect(res.data).toHaveLength(2);
    expect(res.data[0].profileCompleteness).toBeGreaterThan(0);
    expect(res.data[1].needsInvite).toBe(true);
    expect(res.aggregates.total).toBe(2);
    expect(res.aggregates.publicCount).toBe(1);
    expect(res.aggregates.privateCount).toBe(1);
    expect(res.aggregates.needsInviteCount).toBe(1);
    expect(res.aggregates.byYear).toContainEqual({ year: 2026, count: 1 });
    expect(res.aggregates.byYear).toContainEqual({ year: 2025, count: 1 });
    expect(res.aggregates.topIndustries).toContainEqual({ industry: "Tech", count: 1 });
    expect(res.aggregates.topIndustries).toContainEqual({ industry: "Finance", count: 1 });
  });

  it("status=public filter applies isPublic: true", async () => {
    prismaMock.alumniProfile.findMany.mockResolvedValue([] as never);
    prismaMock.alumniProfile.count.mockResolvedValue(0 as never);
    prismaMock.student.findMany.mockResolvedValue([] as never);

    await getAlumniDashboardAction({ status: "public" });

    expect(prismaMock.alumniProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isPublic: true }),
      }),
    );
  });

  it("status=incomplete filter applies bio:null + currentEmployer:null", async () => {
    prismaMock.alumniProfile.findMany.mockResolvedValue([] as never);
    prismaMock.alumniProfile.count.mockResolvedValue(0 as never);
    prismaMock.student.findMany.mockResolvedValue([] as never);

    await getAlumniDashboardAction({ status: "incomplete" });

    expect(prismaMock.alumniProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ bio: null, currentEmployer: null }),
      }),
    );
  });

  it("status=needs_invite filters rows post-join (userId === null)", async () => {
    prismaMock.alumniProfile.findMany
      .mockResolvedValueOnce([
        {
          id: "ap-1",
          studentId: "s-1",
          schoolId: "default-school",
          graduationYear: 2026,
          email: null,
          phone: null,
          address: null,
          currentEmployer: null,
          currentPosition: null,
          industry: null,
          highestEducation: null,
          linkedinUrl: null,
          bio: null,
          isPublic: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "ap-2",
          studentId: "s-2",
          schoolId: "default-school",
          graduationYear: 2026,
          email: null,
          phone: null,
          address: null,
          currentEmployer: null,
          currentPosition: null,
          industry: null,
          highestEducation: null,
          linkedinUrl: null,
          bio: null,
          isPublic: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as never)
      .mockResolvedValueOnce([] as never);
    prismaMock.alumniProfile.count.mockResolvedValue(2 as never);
    prismaMock.student.findMany
      .mockResolvedValueOnce([
        { id: "s-1", firstName: "A", lastName: "X", studentId: "STU-1", photoUrl: null, userId: "u-1" },
        { id: "s-2", firstName: "B", lastName: "Y", studentId: "STU-2", photoUrl: null, userId: null },
      ] as never)
      .mockResolvedValueOnce([] as never);

    const res = await getAlumniDashboardAction({ status: "needs_invite" });
    if (!("data" in res)) throw new Error("expected data");
    expect(res.data).toHaveLength(1);
    expect(res.data[0].studentId).toBe("s-2");
    expect(res.data[0].needsInvite).toBe(true);
  });
});
