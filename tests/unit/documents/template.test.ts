import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import {
  listDocumentTemplatesAction,
  createDocumentTemplateAction,
  reviseDocumentTemplateAction,
  publishDocumentTemplateAction,
} from "@/modules/documents/actions/template.action";

describe("listDocumentTemplatesAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("rejects unauthenticated users", async () => {
    mockUnauthenticated();
    const r = await listDocumentTemplatesAction();
    expect(r).toEqual({ error: "Unauthorized" });
  });

  it("tags templates by scope", async () => {
    prismaMock.documentTemplate.findMany.mockResolvedValue([
      {
        id: "g1",
        schoolId: null,
        key: "offer_letter",
        name: "Offer Letter",
        description: null,
        engine: "HANDLEBARS_PDF",
        status: "PUBLISHED",
        activeVersion: { id: "v1", version: 1 },
        updatedAt: new Date(),
      },
      {
        id: "s1",
        schoolId: "default-school",
        key: "offer_letter",
        name: "Offer Letter (tenant)",
        description: null,
        engine: "HANDLEBARS_PDF",
        status: "DRAFT",
        activeVersion: { id: "v2", version: 1 },
        updatedAt: new Date(),
      },
    ] as never);

    const r = await listDocumentTemplatesAction();
    expect("data" in r).toBe(true);
    if ("data" in r) {
      expect(r.data.find((t) => t.id === "g1")?.scope).toBe("global");
      expect(r.data.find((t) => t.id === "s1")?.scope).toBe("school");
    }
  });
});

describe("createDocumentTemplateAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("rejects invalid key shape", async () => {
    const r = await createDocumentTemplateAction({
      key: "bad key",
      name: "x",
      engine: "HANDLEBARS_PDF",
      bodyHtml: "<p>hi</p>",
    });
    expect("error" in r).toBe(true);
  });

  it("requires bodyHtml for HANDLEBARS_PDF", async () => {
    const r = await createDocumentTemplateAction({
      key: "letter",
      name: "Letter",
      engine: "HANDLEBARS_PDF",
    });
    expect(r).toEqual({ error: "HANDLEBARS_PDF templates require a bodyHtml." });
  });

  it("requires componentKey for REACT_PDF", async () => {
    const r = await createDocumentTemplateAction({
      key: "payslip",
      name: "Payslip",
      engine: "REACT_PDF",
    });
    expect(r).toEqual({ error: "REACT_PDF templates require a componentKey." });
  });

  it("creates template + initial version atomically", async () => {
    prismaMock.documentTemplate.create.mockResolvedValue({
      id: "t1",
      key: "offer_letter",
    } as never);
    prismaMock.documentTemplateVersion.create.mockResolvedValue({ id: "v1" } as never);

    const r = await createDocumentTemplateAction({
      key: "offer_letter",
      name: "Offer Letter",
      engine: "HANDLEBARS_PDF",
      bodyHtml: "<p>Hi {{name}}</p>",
      variables: ["name"],
    });
    expect("data" in r).toBe(true);
    expect(prismaMock.documentTemplate.create).toHaveBeenCalled();
    expect(prismaMock.documentTemplateVersion.create).toHaveBeenCalled();
  });
});

describe("reviseDocumentTemplateAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("refuses cross-tenant revision", async () => {
    prismaMock.documentTemplate.findUnique.mockResolvedValue({
      id: "t1",
      schoolId: "other-school",
      bodyHtml: "<p>x</p>",
      componentKey: null,
      variables: null,
    } as never);
    const r = await reviseDocumentTemplateAction("t1", { bodyHtml: "<p>y</p>" });
    expect(r).toEqual({ error: "Template not found." });
  });

  it("creates a new version and bumps the template pointer", async () => {
    prismaMock.documentTemplate.findUnique.mockResolvedValue({
      id: "t1",
      schoolId: "default-school",
      bodyHtml: "<p>v1</p>",
      componentKey: null,
      variables: null,
      key: "letter",
    } as never);
    prismaMock.documentTemplateVersion.count.mockResolvedValue(1 as never);
    prismaMock.documentTemplateVersion.create.mockResolvedValue({
      id: "v2",
    } as never);

    const r = await reviseDocumentTemplateAction("t1", { bodyHtml: "<p>v2</p>" });
    expect("data" in r).toBe(true);
    if ("data" in r) {
      expect(r.data.version).toBe(2);
    }
  });
});

describe("publishDocumentTemplateAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("refuses when template has no active version", async () => {
    prismaMock.documentTemplate.findUnique.mockResolvedValue({
      id: "t1",
      schoolId: "default-school",
      activeVersionId: null,
      status: "DRAFT",
      key: "letter",
    } as never);
    const r = await publishDocumentTemplateAction("t1");
    expect(r).toEqual({ error: "Template has no version to publish." });
  });

  it("publishes when a version exists", async () => {
    prismaMock.documentTemplate.findUnique.mockResolvedValue({
      id: "t1",
      schoolId: "default-school",
      activeVersionId: "v1",
      status: "DRAFT",
      key: "letter",
    } as never);
    const r = await publishDocumentTemplateAction("t1");
    expect(r).toEqual({ success: true });
    expect(prismaMock.documentTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PUBLISHED" }),
      }),
    );
  });
});
