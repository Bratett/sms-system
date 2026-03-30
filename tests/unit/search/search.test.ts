import { describe, it, expect, beforeEach } from "vitest";
import {
  prismaMock,
  mockAuthenticatedUser,
  mockUnauthenticated,
} from "../setup";

import { globalSearchAction } from "@/modules/search/actions/search.action";

describe("globalSearchAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await globalSearchAction("John");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return empty results for short query", async () => {
    const result = await globalSearchAction("J");
    expect(result).toEqual({ students: [], staff: [], subjects: [], items: [] });
  });

  it("should return empty results for empty query", async () => {
    const result = await globalSearchAction("");
    expect(result).toEqual({ students: [], staff: [], subjects: [], items: [] });
  });

  it("should return empty results when no school configured", async () => {
    prismaMock.school.findFirst.mockResolvedValue(null);
    const result = await globalSearchAction("John");
    expect(result).toEqual({ students: [], staff: [], subjects: [], items: [] });
  });

  it("should return search results across all categories", async () => {
    prismaMock.student.findMany.mockResolvedValue([
      {
        id: "stu-1",
        studentId: "STU/2025/0001",
        firstName: "John",
        lastName: "Doe",
        status: "ACTIVE",
        enrollments: [
          {
            classArm: {
              name: "A",
              class: { name: "SHS 1" },
            },
          },
        ],
      },
    ] as never);

    prismaMock.staff.findMany.mockResolvedValue([
      {
        id: "staff-1",
        staffId: "STF/2025/0001",
        firstName: "John",
        lastName: "Smith",
        staffType: "TEACHING",
        status: "ACTIVE",
      },
    ] as never);

    prismaMock.subject.findMany.mockResolvedValue([
      { id: "sub-1", name: "Mathematics", code: "MATH" },
    ] as never);

    prismaMock.storeItem.findMany.mockResolvedValue([
      {
        id: "item-1",
        name: "Chalk",
        quantity: 50,
        category: { name: "Stationery" },
      },
    ] as never);

    const result = await globalSearchAction("John");

    expect(result).not.toHaveProperty("error");

    const data = result as {
      students: { name: string; class: string | null }[];
      staff: { name: string }[];
      subjects: { name: string }[];
      items: { name: string }[];
    };

    expect(data.students).toHaveLength(1);
    expect(data.students[0].name).toBe("John Doe");
    expect(data.students[0].class).toBe("SHS 1 A");
    expect(data.staff).toHaveLength(1);
    expect(data.staff[0].name).toBe("John Smith");
    expect(data.subjects).toHaveLength(1);
    expect(data.items).toHaveLength(1);
  });

  it("should handle students with no enrollments", async () => {
    prismaMock.student.findMany.mockResolvedValue([
      {
        id: "stu-1",
        studentId: "STU/2025/0001",
        firstName: "John",
        lastName: "Doe",
        status: "ACTIVE",
        enrollments: [],
      },
    ] as never);
    prismaMock.staff.findMany.mockResolvedValue([] as never);
    prismaMock.subject.findMany.mockResolvedValue([] as never);
    prismaMock.storeItem.findMany.mockResolvedValue([] as never);

    const result = await globalSearchAction("John");
    const data = result as { students: { class: string | null }[] };
    expect(data.students[0].class).toBeNull();
  });

  it("should respect the limit parameter", async () => {
    prismaMock.student.findMany.mockResolvedValue([] as never);
    prismaMock.staff.findMany.mockResolvedValue([] as never);
    prismaMock.subject.findMany.mockResolvedValue([] as never);
    prismaMock.storeItem.findMany.mockResolvedValue([] as never);

    await globalSearchAction("test", 3);

    // Verify limit is passed to queries
    expect(prismaMock.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 3 }),
    );
  });
});
