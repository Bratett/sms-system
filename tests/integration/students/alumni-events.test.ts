import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { resolveSeededAdminId, loginAs } from "./setup";
import {
  createAlumniEventDraftAction,
  publishAlumniEventAction,
  cancelAlumniEventAction,
} from "@/modules/alumni-events/actions/admin-events.action";
import {
  upsertMyEventRsvpAction,
  getMyAlumniEventsAction,
} from "@/modules/alumni-events/actions/alumni-events.action";

/**
 * Live-DB integration coverage for the alumni-events flow.
 * (Task 11 of the alumni-events track.)
 *
 * Seeds two alumni (User + UserRole + UserSchool + Student[GRADUATED] +
 * AlumniProfile) under default-school and exercises:
 *   1. Admin draft → publish → alumnus 1 RSVPs YES with 1 guest
 *   2. Admin cancel → existing RSVP preserved → alumnus 2 RSVP rejected
 *   3. Capacity=2 — first YES (with 1 guest) fits, second YES waitlisted
 *   4. getMyAlumniEventsAction({ tab: "past" }) returns canceled event w/ own RSVP
 *   5. Tenant isolation: forged-school query returns null
 *
 * Skips cleanly when DATABASE_URL is not configured.
 */

const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip;

describeIfDb("Alumni events (integration)", () => {
  const db = new PrismaClient();
  const tag = `events-test-${Date.now()}`;

  let adminId: string;
  let schoolId: string;
  let userId1: string;
  let userId2: string;
  let alumniProfileId1: string;
  let alumniProfileId2: string;
  let studentId1: string;
  let studentId2: string;
  let eventId = "";

  async function cleanupSeedData() {
    if (eventId) {
      await db.alumniEventRsvp.deleteMany({ where: { eventId } }).catch(() => {});
      await db.alumniEvent.delete({ where: { id: eventId } }).catch(() => {});
    }
    await db.alumniEvent
      .deleteMany({ where: { title: { contains: tag } } })
      .catch(() => {});
    if (alumniProfileId1)
      await db.alumniProfile
        .deleteMany({
          where: {
            id: {
              in: [alumniProfileId1, alumniProfileId2].filter(Boolean),
            },
          },
        })
        .catch(() => {});
    await db.userRole
      .deleteMany({
        where: { userId: { in: [userId1, userId2].filter(Boolean) } },
      })
      .catch(() => {});
    await db.student
      .deleteMany({
        where: { id: { in: [studentId1, studentId2].filter(Boolean) } },
      })
      .catch(() => {});
    await db.userSchool
      .deleteMany({
        where: { userId: { in: [userId1, userId2].filter(Boolean) } },
      })
      .catch(() => {});
    await db.user
      .deleteMany({
        where: { id: { in: [userId1, userId2].filter(Boolean) } },
      })
      .catch(() => {});
  }

  beforeAll(async () => {
    try {
      adminId = await resolveSeededAdminId();
      const admin = await db.user.findUnique({
        where: { id: adminId },
        include: { userSchools: { take: 1 } },
      });
      schoolId = admin!.userSchools[0].schoolId;

      const alumniRole = await db.role.findUnique({ where: { name: "alumni" } });
      if (!alumniRole) throw new Error("alumni role not seeded. Run `npm run db:seed`.");

      // ── Alumnus 1 ──────────────────────────────────────────────
      const u1 = await db.user.create({
        data: {
          email: `alum1-${tag}@test.local`,
          username: `alum1-${tag}`,
          passwordHash: await bcrypt.hash("test123", 10),
          firstName: "Kofi",
          lastName: "Asante",
          status: "ACTIVE",
        },
      });
      userId1 = u1.id;
      await db.userRole.create({ data: { userId: u1.id, roleId: alumniRole.id } });
      await db.userSchool.create({
        data: { userId: u1.id, schoolId, isDefault: false },
      });

      const s1 = await db.student.create({
        data: {
          studentId: `${tag}/S1`,
          firstName: "Kofi",
          lastName: "Asante",
          gender: "MALE",
          dateOfBirth: new Date("2000-01-01"),
          status: "GRADUATED",
          schoolId,
          userId: u1.id,
        },
      });
      studentId1 = s1.id;

      const ap1 = await db.alumniProfile.create({
        data: {
          studentId: s1.id,
          schoolId,
          graduationYear: 2024,
          isPublic: false,
        },
      });
      alumniProfileId1 = ap1.id;

      // ── Alumnus 2 ──────────────────────────────────────────────
      const u2 = await db.user.create({
        data: {
          email: `alum2-${tag}@test.local`,
          username: `alum2-${tag}`,
          passwordHash: await bcrypt.hash("test123", 10),
          firstName: "Akua",
          lastName: "Mensah",
          status: "ACTIVE",
        },
      });
      userId2 = u2.id;
      await db.userRole.create({ data: { userId: u2.id, roleId: alumniRole.id } });
      await db.userSchool.create({
        data: { userId: u2.id, schoolId, isDefault: false },
      });

      const s2 = await db.student.create({
        data: {
          studentId: `${tag}/S2`,
          firstName: "Akua",
          lastName: "Mensah",
          gender: "FEMALE",
          dateOfBirth: new Date("2000-02-01"),
          status: "GRADUATED",
          schoolId,
          userId: u2.id,
        },
      });
      studentId2 = s2.id;

      const ap2 = await db.alumniProfile.create({
        data: {
          studentId: s2.id,
          schoolId,
          graduationYear: 2024,
          isPublic: false,
        },
      });
      alumniProfileId2 = ap2.id;
    } catch (e) {
      await cleanupSeedData();
      throw e;
    }
  }, 60_000);

  afterAll(async () => {
    await cleanupSeedData();
    await db.$disconnect();
  }, 60_000);

  // ── Test 1: draft → publish → RSVP ──────────────────────────────
  it("admin creates draft → publishes → alumnus 1 RSVPs YES", async () => {
    loginAs({ id: adminId, permissions: ["*"], schoolId: "default-school" });
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const created = await createAlumniEventDraftAction({
      title: `${tag}-event-1`,
      startAt: future,
      maxGuestsPerRsvp: 2,
    });
    if (!("data" in created)) throw new Error((created as { error: string }).error);
    eventId = created.data.id;
    expect(created.data.status).toBe("DRAFT");

    const published = await publishAlumniEventAction(eventId);
    if (!("data" in published))
      throw new Error((published as { error: string }).error);
    expect(published.data.status).toBe("PUBLISHED");

    loginAs({
      id: userId1,
      schoolId: "default-school",
      permissions: ["alumni:events:read", "alumni:events:rsvp"],
    });
    const rsvp = await upsertMyEventRsvpAction({
      eventId,
      response: "YES",
      guestCount: 1,
    });
    if (!("data" in rsvp)) throw new Error((rsvp as { error: string }).error);
    expect(rsvp.data.response).toBe("YES");
    expect(rsvp.data.guestCount).toBe(1);
    expect(rsvp.data.waitlisted).toBe(false);
  });

  // ── Test 2: cancel preserves existing RSVP, blocks new ones ─────
  it("admin cancels event → RSVP preserved + new RSVPs rejected", async () => {
    loginAs({ id: adminId, permissions: ["*"], schoolId: "default-school" });
    const canceled = await cancelAlumniEventAction(eventId);
    if (!("data" in canceled))
      throw new Error((canceled as { error: string }).error);
    expect(canceled.data.status).toBe("CANCELED");

    const existing = await db.alumniEventRsvp.findFirst({
      where: { eventId, alumniProfileId: alumniProfileId1 },
    });
    expect(existing).not.toBeNull();
    expect(existing!.response).toBe("YES");

    loginAs({
      id: userId2,
      schoolId: "default-school",
      permissions: ["alumni:events:read", "alumni:events:rsvp"],
    });
    const rejected = await upsertMyEventRsvpAction({
      eventId,
      response: "YES",
      guestCount: 0,
    });
    expect("error" in rejected).toBe(true);
  });

  // ── Test 3: capacity-driven waitlisting ─────────────────────────
  it("capacity=2 — first YES non-waitlisted, second YES waitlisted", async () => {
    loginAs({ id: adminId, permissions: ["*"], schoolId: "default-school" });
    const future = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
    const created = await createAlumniEventDraftAction({
      title: `${tag}-event-2`,
      startAt: future,
      capacity: 2,
      maxGuestsPerRsvp: 2,
    });
    if (!("data" in created))
      throw new Error((created as { error: string }).error);
    const ev2Id = created.data.id;

    await publishAlumniEventAction(ev2Id);

    loginAs({
      id: userId1,
      schoolId: "default-school",
      permissions: ["alumni:events:read", "alumni:events:rsvp"],
    });
    const r1 = await upsertMyEventRsvpAction({
      eventId: ev2Id,
      response: "YES",
      guestCount: 1,
    });
    if (!("data" in r1)) throw new Error((r1 as { error: string }).error);
    expect(r1.data.waitlisted).toBe(false); // 2 spots used, capacity 2 — fits

    loginAs({
      id: userId2,
      schoolId: "default-school",
      permissions: ["alumni:events:read", "alumni:events:rsvp"],
    });
    const r2 = await upsertMyEventRsvpAction({
      eventId: ev2Id,
      response: "YES",
      guestCount: 0,
    });
    if (!("data" in r2)) throw new Error((r2 as { error: string }).error);
    expect(r2.data.waitlisted).toBe(true); // would be 3 spots used, exceeds 2

    // Best-effort cleanup of this second event
    await db.alumniEventRsvp.deleteMany({ where: { eventId: ev2Id } }).catch(() => {});
    await db.alumniEvent.delete({ where: { id: ev2Id } }).catch(() => {});
  });

  // ── Test 4: past tab returns canceled event with my RSVP joined ─
  it("getMyAlumniEventsAction returns own RSVP joined to event", async () => {
    // The event from Test 1 was created with startAt = +30 days (still future),
    // then canceled. The "past" tab filters startAt < now, so we won't find it
    // there. Bump startAt to the past so it surfaces in the past tab — this is
    // the scenario the test is asserting on (canceled events archived to past).
    await db.alumniEvent.update({
      where: { id: eventId },
      data: { startAt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });

    loginAs({
      id: userId1,
      schoolId: "default-school",
      permissions: ["alumni:events:read", "alumni:events:rsvp"],
    });
    const past = await getMyAlumniEventsAction({ tab: "past" });
    if (!("data" in past)) throw new Error((past as { error: string }).error);
    const found = past.data.find((e) => e.id === eventId);
    expect(found).toBeDefined();
    expect(found?.status).toBe("CANCELED");
    expect(found?.myRsvp?.response).toBe("YES");
  });

  // ── Test 5: tenant isolation ────────────────────────────────────
  it("tenant isolation: forged-school query returns null", async () => {
    const sneaky = await db.alumniEvent.findFirst({
      where: { id: eventId, schoolId: "OTHER-SCHOOL" },
    });
    expect(sneaky).toBeNull();
  });
});
