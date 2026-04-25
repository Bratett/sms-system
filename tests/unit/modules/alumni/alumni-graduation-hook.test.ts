import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../setup";
import { seedAlumniOnGraduation } from "@/modules/alumni/alumni-graduation-hook";

describe("seedAlumniOnGraduation", () => {
  beforeEach(() => {
    prismaMock.student.findUnique.mockReset();
    prismaMock.user.findUnique.mockReset();
    prismaMock.alumniProfile.upsert.mockReset();
    prismaMock.role.findUnique.mockReset();
    prismaMock.userRole.deleteMany.mockReset();
    prismaMock.userRole.create.mockReset();
  });

  it("creates profile with isPublic=false and graduationYear from ceremonyDate", async () => {
    prismaMock.student.findUnique.mockResolvedValue({ userId: "u-1" } as never);
    prismaMock.user.findUnique.mockResolvedValue({ email: "k@a.com" } as never);
    prismaMock.alumniProfile.upsert.mockResolvedValue({ id: "ap-1" } as never);
    prismaMock.role.findUnique.mockResolvedValue({ id: "role-alumni" } as never);
    prismaMock.userRole.deleteMany.mockResolvedValue({ count: 1 } as never);
    prismaMock.userRole.create.mockResolvedValue({} as never);

    const result = await seedAlumniOnGraduation(prismaMock as never, {
      studentId: "s-1",
      schoolId: "school-1",
      graduationRecord: { batch: { ceremonyDate: new Date("2026-06-15") } },
    });

    expect(result).toEqual({ profileId: "ap-1", userRoleFlipped: true });
    expect(prismaMock.alumniProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { studentId: "s-1" },
        create: expect.objectContaining({
          studentId: "s-1",
          schoolId: "school-1",
          graduationYear: 2026,
          email: "k@a.com",
          isPublic: false,
        }),
        update: {},
      }),
    );
  });

  it("flips user role: deletes student UserRole, creates alumni UserRole", async () => {
    prismaMock.student.findUnique.mockResolvedValue({ userId: "u-1" } as never);
    prismaMock.user.findUnique.mockResolvedValue({ email: "x@a.com" } as never);
    prismaMock.alumniProfile.upsert.mockResolvedValue({ id: "ap-1" } as never);
    prismaMock.role.findUnique.mockResolvedValue({ id: "role-alumni" } as never);
    prismaMock.userRole.deleteMany.mockResolvedValue({ count: 1 } as never);
    prismaMock.userRole.create.mockResolvedValue({} as never);

    await seedAlumniOnGraduation(prismaMock as never, {
      studentId: "s-1",
      schoolId: "school-1",
      graduationRecord: { batch: { ceremonyDate: new Date("2026-06-15") } },
    });

    expect(prismaMock.userRole.deleteMany).toHaveBeenCalledWith({
      where: { userId: "u-1", role: { name: "student" } },
    });
    expect(prismaMock.userRole.create).toHaveBeenCalledWith({
      data: { userId: "u-1", roleId: "role-alumni" },
    });
  });

  it("skips role flip when student has no userId", async () => {
    prismaMock.student.findUnique.mockResolvedValue({
      userId: null,
      user: null,
    } as never);
    prismaMock.alumniProfile.upsert.mockResolvedValue({ id: "ap-1" } as never);

    const result = await seedAlumniOnGraduation(prismaMock as never, {
      studentId: "s-1",
      schoolId: "school-1",
      graduationRecord: { batch: { ceremonyDate: new Date("2026-06-15") } },
    });

    expect(result.userRoleFlipped).toBe(false);
    expect(prismaMock.role.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.userRole.deleteMany).not.toHaveBeenCalled();
    expect(prismaMock.userRole.create).not.toHaveBeenCalled();
  });

  it("falls back to current year when ceremonyDate is null", async () => {
    prismaMock.student.findUnique.mockResolvedValue({ userId: null } as never);
    prismaMock.alumniProfile.upsert.mockResolvedValue({ id: "ap-1" } as never);

    const currentYear = new Date().getFullYear();
    await seedAlumniOnGraduation(prismaMock as never, {
      studentId: "s-1",
      schoolId: "school-1",
      graduationRecord: { batch: { ceremonyDate: null } },
    });

    expect(prismaMock.alumniProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ graduationYear: currentYear }),
      }),
    );
  });

  it("upsert update branch is empty (preserves edits on re-confirmation)", async () => {
    prismaMock.student.findUnique.mockResolvedValue({ userId: null } as never);
    prismaMock.alumniProfile.upsert.mockResolvedValue({ id: "ap-1" } as never);

    await seedAlumniOnGraduation(prismaMock as never, {
      studentId: "s-1",
      schoolId: "school-1",
      graduationRecord: { batch: { ceremonyDate: new Date() } },
    });

    expect(prismaMock.alumniProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: {} }),
    );
  });

  it("throws when student not found", async () => {
    prismaMock.student.findUnique.mockResolvedValue(null as never);

    await expect(
      seedAlumniOnGraduation(prismaMock as never, {
        studentId: "missing",
        schoolId: "school-1",
        graduationRecord: { batch: { ceremonyDate: new Date() } },
      }),
    ).rejects.toThrow(/Student missing not found/);
  });

  it("throws when alumni Role row is missing in DB", async () => {
    prismaMock.student.findUnique.mockResolvedValue({ userId: "u-1" } as never);
    prismaMock.user.findUnique.mockResolvedValue({ email: "x" } as never);
    prismaMock.alumniProfile.upsert.mockResolvedValue({ id: "ap-1" } as never);
    prismaMock.role.findUnique.mockResolvedValue(null as never);

    await expect(
      seedAlumniOnGraduation(prismaMock as never, {
        studentId: "s-1",
        schoolId: "school-1",
        graduationRecord: { batch: { ceremonyDate: new Date() } },
      }),
    ).rejects.toThrow(/alumni role not seeded/i);
  });
});
