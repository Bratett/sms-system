import { describe, it, expect } from "vitest";
import { parseAndValidate, generateTemplate } from "@/lib/import/framework";

describe("Import Framework", () => {
  const columns = [
    { key: "firstName", header: "First Name", required: true },
    { key: "lastName", header: "Last Name", required: true },
    { key: "email", header: "Email", validate: (v: string) => (v.includes("@") ? null : "Invalid email") },
    { key: "phone", header: "Phone" },
  ];

  describe("parseAndValidate", () => {
    it("should parse valid CSV with all required fields", () => {
      const csv = `First Name,Last Name,Email,Phone
Kofi,Mensah,kofi@test.com,0201234567
Ama,Owusu,ama@test.com,0209876543`;

      const result = parseAndValidate(csv, columns);
      expect(result.validCount).toBe(2);
      expect(result.errorCount).toBe(0);
      expect(result.totalRows).toBe(2);
      expect(result.valid[0]).toEqual({
        firstName: "Kofi",
        lastName: "Mensah",
        email: "kofi@test.com",
        phone: "0201234567",
      });
    });

    it("should report missing required fields", () => {
      const csv = `First Name,Last Name,Email,Phone
Kofi,,kofi@test.com,0201234567`;

      const result = parseAndValidate(csv, columns);
      expect(result.errorCount).toBe(1);
      expect(result.errors[0].row).toBe(2);
      expect(result.errors[0].column).toBe("Last Name");
      expect(result.errors[0].message).toContain("Required");
    });

    it("should report missing required columns", () => {
      const csv = `First Name,Email
Kofi,kofi@test.com`;

      const result = parseAndValidate(csv, columns);
      expect(result.errors.some((e) => e.column === "Last Name")).toBe(true);
    });

    it("should validate field values using custom validators", () => {
      const csv = `First Name,Last Name,Email,Phone
Kofi,Mensah,not-an-email,0201234567`;

      const result = parseAndValidate(csv, columns);
      expect(result.errorCount).toBe(1);
      expect(result.errors[0].column).toBe("Email");
      expect(result.errors[0].message).toBe("Invalid email");
    });

    it("should handle optional fields being empty", () => {
      const csv = `First Name,Last Name,Email,Phone
Kofi,Mensah,,`;

      const result = parseAndValidate(csv, columns);
      expect(result.validCount).toBe(1);
      expect(result.valid[0].email).toBeNull();
      expect(result.valid[0].phone).toBeNull();
    });

    it("should trim whitespace from values", () => {
      const csv = `First Name,Last Name,Email,Phone
 Kofi , Mensah ,kofi@test.com,`;

      const result = parseAndValidate(csv, columns);
      expect(result.valid[0].firstName).toBe("Kofi");
      expect(result.valid[0].lastName).toBe("Mensah");
    });

    it("should handle empty CSV", () => {
      const csv = `First Name,Last Name,Email,Phone`;

      const result = parseAndValidate(csv, columns);
      expect(result.totalRows).toBe(0);
      expect(result.validCount).toBe(0);
    });

    it("should separate valid and invalid rows", () => {
      const csv = `First Name,Last Name,Email,Phone
Kofi,Mensah,kofi@test.com,020
,Owusu,ama@test.com,020
Kwame,Asante,bad-email,020`;

      const result = parseAndValidate(csv, columns);
      expect(result.validCount).toBe(1); // Only Kofi is fully valid
      expect(result.errorCount).toBe(2); // Row 3 missing first name, Row 4 bad email
    });
  });

  describe("generateTemplate", () => {
    it("should generate CSV header row from column definitions", () => {
      const template = generateTemplate(columns);
      expect(template).toBe("First Name,Last Name,Email,Phone\n");
    });
  });
});
