import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser } from "../../setup";
import {
  getParentAnnouncementsAction,
  getParentCircularsAction,
} from "@/modules/portal/actions/parent.action";

const fakeClassAnnouncement = {
  id: "a-class",
  schoolId: "default-school",
  status: "PUBLISHED",
  targetType: "class",
  targetIds: ["class-a"],
  title: "Class A only",
  content: "x",
  priority: "normal",
  publishedAt: new Date(),
  expiresAt: null,
  requiresAcknowledgement: false,
  lastReminderSentAt: null,
  createdBy: "admin",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const fakeAllAnnouncement = {
  ...fakeClassAnnouncement,
  id: "a-all",
  targetType: "all",
  targetIds: null,
  title: "For everyone",
};

function mockGuardianWithStudents(
  students: Array<{
    id: string;
    classArmId: string | null;
    classId: string | null;
    programmeId: string | null;
    houseId: string | null;
  }>,
) {
  prismaMock.guardian.findUnique.mockResolvedValue({
    userId: "test-user-id",
    householdId: "hh-1",
    students: students.map((s) => ({
      student: {
        id: s.id,
        status: "ACTIVE",
        enrollments: s.classArmId
          ? [
              {
                status: "ACTIVE",
                classArmId: s.classArmId,
                classArm: {
                  id: s.classArmId,
                  classId: s.classId,
                  class: { programmeId: s.programmeId },
                },
              },
            ]
          : [],
        houseAssignment: s.houseId ? { houseId: s.houseId } : null,
      },
    })),
  } as never);
}

describe("getParentAnnouncementsAction (targeting bug regression)", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ["communication:announcements:read"] });
  });

  it("class-targeted circular is visible to guardian of student in that class", async () => {
    mockGuardianWithStudents([
      { id: "s1", classArmId: "arm-a", classId: "class-a", programmeId: "prog-1", houseId: null },
    ]);
    prismaMock.announcement.findMany.mockResolvedValue([fakeClassAnnouncement] as never);

    const res = await getParentAnnouncementsAction();
    if (!("data" in res)) throw new Error("expected data");
    expect(res.data.map((a) => a.id)).toContain("a-class");
  });

  it("class-targeted circular is invisible to guardian of student NOT in that class", async () => {
    mockGuardianWithStudents([
      { id: "s1", classArmId: "arm-b", classId: "class-b", programmeId: "prog-1", houseId: null },
    ]);
    prismaMock.announcement.findMany.mockResolvedValue([fakeClassAnnouncement] as never);

    const res = await getParentAnnouncementsAction();
    if (!("data" in res)) throw new Error("expected data");
    expect(res.data.map((a) => a.id)).not.toContain("a-class");
  });

  it("all-targeted circular visible to every guardian", async () => {
    mockGuardianWithStudents([
      { id: "s1", classArmId: "arm-b", classId: "class-b", programmeId: "prog-2", houseId: null },
    ]);
    prismaMock.announcement.findMany.mockResolvedValue([fakeAllAnnouncement] as never);

    const res = await getParentAnnouncementsAction();
    if (!("data" in res)) throw new Error("expected data");
    expect(res.data.map((a) => a.id)).toContain("a-all");
  });
});

describe("getParentCircularsAction tabs", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ["communication:announcements:read"] });
  });

  it("pending tab returns ack-required circulars not yet acknowledged by my household", async () => {
    mockGuardianWithStudents([
      { id: "s1", classArmId: "arm-a", classId: "class-a", programmeId: "prog-1", houseId: null },
    ]);
    prismaMock.announcement.findMany.mockResolvedValue([
      { ...fakeAllAnnouncement, id: "a-ack", requiresAcknowledgement: true },
      { ...fakeAllAnnouncement, id: "a-routine", requiresAcknowledgement: false },
      { ...fakeAllAnnouncement, id: "a-acked", requiresAcknowledgement: true },
    ] as never);
    prismaMock.circularAcknowledgement.findMany.mockResolvedValue([
      { announcementId: "a-acked", householdId: "hh-1" },
    ] as never);

    const res = await getParentCircularsAction({ tab: "pending" });
    if (!("data" in res)) throw new Error("expected data: " + JSON.stringify(res));
    const ids = res.data.map((a) => a.id);
    expect(ids).toContain("a-ack");
    expect(ids).not.toContain("a-routine");
    expect(ids).not.toContain("a-acked");
  });

  it("history tab returns everything else (routine + already-acknowledged)", async () => {
    mockGuardianWithStudents([
      { id: "s1", classArmId: "arm-a", classId: "class-a", programmeId: "prog-1", houseId: null },
    ]);
    prismaMock.announcement.findMany.mockResolvedValue([
      { ...fakeAllAnnouncement, id: "a-ack", requiresAcknowledgement: true },
      { ...fakeAllAnnouncement, id: "a-routine", requiresAcknowledgement: false },
      { ...fakeAllAnnouncement, id: "a-acked", requiresAcknowledgement: true },
    ] as never);
    prismaMock.circularAcknowledgement.findMany.mockResolvedValue([
      { announcementId: "a-acked", householdId: "hh-1" },
    ] as never);

    const res = await getParentCircularsAction({ tab: "history" });
    if (!("data" in res)) throw new Error("expected data: " + JSON.stringify(res));
    const ids = res.data.map((a) => a.id);
    expect(ids).toContain("a-routine");
    expect(ids).toContain("a-acked");
    expect(ids).not.toContain("a-ack");
  });
});
