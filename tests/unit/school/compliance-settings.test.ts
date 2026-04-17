import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import {
  getComplianceSettingsAction,
  updateComplianceSettingsAction,
} from "@/modules/school/actions/compliance-settings.action";

describe("getComplianceSettingsAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("rejects unauthenticated users", async () => {
    mockUnauthenticated();
    const r = await getComplianceSettingsAction();
    expect(r).toEqual({ error: "Unauthorized" });
  });

  it("returns school compliance fields", async () => {
    prismaMock.school.findUnique.mockResolvedValue({
      id: "default-school",
      name: "Ghana SHS",
      tin: "C0001234567",
      ssnitEmployerNumber: "EMP/123",
      getFundCode: "GF-2026-A",
      graVatTin: null,
      ghanaEducationServiceCode: "GAR/001",
    } as never);

    const r = await getComplianceSettingsAction();
    expect("data" in r).toBe(true);
    if ("data" in r) {
      expect(r.data.tin).toBe("C0001234567");
    }
  });
});

describe("updateComplianceSettingsAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("rejects invalid input", async () => {
    const r = await updateComplianceSettingsAction({
      tin: "x".repeat(60),
    } as never);
    expect("error" in r).toBe(true);
  });

  it("persists trimmed identifiers; treats empty strings as nulls at the client", async () => {
    prismaMock.school.findUnique.mockResolvedValue({
      tin: null,
      ssnitEmployerNumber: null,
      getFundCode: null,
      graVatTin: null,
      ghanaEducationServiceCode: null,
    } as never);
    prismaMock.school.update.mockResolvedValue({
      id: "default-school",
      tin: "C0001234567",
      ssnitEmployerNumber: null,
      getFundCode: null,
      graVatTin: null,
      ghanaEducationServiceCode: null,
    } as never);

    const r = await updateComplianceSettingsAction({
      tin: "C0001234567",
    });
    expect("data" in r).toBe(true);
    expect(prismaMock.school.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "default-school" },
        data: expect.objectContaining({ tin: "C0001234567" }),
      }),
    );
  });
});
