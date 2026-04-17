import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import {
  scanExeatAction,
  gateDepartAction,
  gateReturnAction,
} from "@/modules/boarding/actions/exeat-gate.action";

describe("scanExeatAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("rejects unauthenticated users", async () => {
    mockUnauthenticated();
    const r = await scanExeatAction({ exeatNumber: "EXT/2026/0001" });
    expect(r).toEqual({ error: "Unauthorized" });
  });

  it("returns error when exeat not found", async () => {
    prismaMock.exeat.findUnique.mockResolvedValue(null as never);
    const r = await scanExeatAction({ exeatNumber: "EXT/2026/0001" });
    expect(r).toEqual({ error: "Exeat not found." });
  });

  it("returns scanned exeat with canDepart=true when OTP is verified", async () => {
    prismaMock.exeat.findUnique.mockResolvedValue({
      id: "e1",
      schoolId: "default-school",
      exeatNumber: "EXT/2026/0001",
      status: "HEADMASTER_APPROVED",
      type: "NORMAL",
      studentId: "s1",
      guardianPhone: "0241234567",
      expectedReturnDate: new Date(),
      actualReturnDate: null,
    } as never);
    prismaMock.student.findUnique.mockResolvedValue({
      id: "s1",
      studentId: "STU/001",
      firstName: "Ama",
      lastName: "Owusu",
      photoUrl: null,
      boardingStatus: "BOARDING",
    } as never);
    prismaMock.exeatOtp.findFirst.mockResolvedValue({
      id: "otp-1",
      status: "VERIFIED",
    } as never);

    const r = await scanExeatAction({ exeatNumber: "EXT/2026/0001" });
    expect("data" in r).toBe(true);
    if ("data" in r) {
      expect(r.data.canDepart).toBe(true);
      expect(r.data.canReturn).toBe(false);
      expect(r.data.student?.fullName).toBe("Ama Owusu");
      expect(r.data.hasVerifiedOtp).toBe(true);
    }
  });

  it("canDepart=false when no verified OTP", async () => {
    prismaMock.exeat.findUnique.mockResolvedValue({
      id: "e1",
      schoolId: "default-school",
      exeatNumber: "EXT/2026/0001",
      status: "HEADMASTER_APPROVED",
      type: "NORMAL",
      studentId: "s1",
      guardianPhone: "0241234567",
      expectedReturnDate: new Date(),
      actualReturnDate: null,
    } as never);
    prismaMock.student.findUnique.mockResolvedValue(null as never);
    prismaMock.exeatOtp.findFirst.mockResolvedValue(null as never);

    const r = await scanExeatAction({ exeatNumber: "EXT/2026/0001" });
    if ("data" in r) {
      expect(r.data.canDepart).toBe(false);
      expect(r.data.hasVerifiedOtp).toBe(false);
    }
  });

  it("canReturn=true only when status is DEPARTED or OVERDUE", async () => {
    for (const [status, expected] of [
      ["DEPARTED", true],
      ["OVERDUE", true],
      ["HEADMASTER_APPROVED", false],
      ["RETURNED", false],
    ] as const) {
      prismaMock.exeat.findUnique.mockResolvedValue({
        id: "e1",
        schoolId: "default-school",
        exeatNumber: "EXT/2026/0001",
        status,
        type: "NORMAL",
        studentId: "s1",
        guardianPhone: "0241234567",
        expectedReturnDate: new Date(),
        actualReturnDate: null,
      } as never);
      prismaMock.student.findUnique.mockResolvedValue(null as never);
      prismaMock.exeatOtp.findFirst.mockResolvedValue(null as never);

      const r = await scanExeatAction({ exeatNumber: "EXT/2026/0001" });
      if ("data" in r) {
        expect(r.data.canReturn).toBe(expected);
      }
    }
  });
});

describe("gateDepartAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("rejects when exeat is not HEADMASTER_APPROVED", async () => {
    prismaMock.exeat.findUnique.mockResolvedValue({
      id: "e1",
      schoolId: "default-school",
      status: "HOUSEMASTER_APPROVED",
    } as never);
    const r = await gateDepartAction({ exeatId: "e1" });
    expect(r).toEqual({
      error: "Exeat must be approved by headmaster before departure.",
    });
  });

  it("rejects when no verified OTP exists", async () => {
    prismaMock.exeat.findUnique.mockResolvedValue({
      id: "e1",
      schoolId: "default-school",
      status: "HEADMASTER_APPROVED",
      exeatNumber: "EXT/2026/0001",
    } as never);
    prismaMock.exeatOtp.findFirst.mockResolvedValue(null as never);
    const r = await gateDepartAction({ exeatId: "e1" });
    expect(r).toEqual({
      error: "Guardian OTP must be verified before releasing the student.",
    });
  });

  it("transitions workflow and creates ExeatMovement when OTP verified", async () => {
    prismaMock.exeat.findUnique.mockResolvedValue({
      id: "e1",
      schoolId: "default-school",
      status: "HEADMASTER_APPROVED",
      exeatNumber: "EXT/2026/0001",
      type: "NORMAL",
    } as never);
    prismaMock.exeatOtp.findFirst.mockResolvedValue({
      id: "otp-1",
      status: "VERIFIED",
    } as never);

    const r = await gateDepartAction({
      exeatId: "e1",
      geoLat: 5.6,
      geoLng: -0.2,
    });
    expect(r).toEqual({ success: true });
    expect(prismaMock.exeatMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          exeatId: "e1",
          kind: "DEPART",
          geoLat: 5.6,
          geoLng: -0.2,
        }),
      }),
    );
  });
});

describe("gateReturnAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("rejects when exeat is not DEPARTED or OVERDUE", async () => {
    prismaMock.exeat.findUnique.mockResolvedValue({
      id: "e1",
      schoolId: "default-school",
      status: "HEADMASTER_APPROVED",
    } as never);
    const r = await gateReturnAction({ exeatId: "e1" });
    expect(r).toEqual({ error: "Exeat must be in DEPARTED or OVERDUE status." });
  });

  it("transitions workflow and creates RETURN movement", async () => {
    prismaMock.exeat.findUnique.mockResolvedValue({
      id: "e1",
      schoolId: "default-school",
      status: "DEPARTED",
      exeatNumber: "EXT/2026/0001",
      type: "NORMAL",
    } as never);

    const r = await gateReturnAction({ exeatId: "e1" });
    expect(r).toEqual({ success: true });
    expect(prismaMock.exeatMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kind: "RETURN" }),
      }),
    );
  });
});
