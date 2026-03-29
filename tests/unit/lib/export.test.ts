import { describe, it, expect } from "vitest";
import { generateExport, getExportContentType, getExportExtension } from "@/lib/export";

describe("Export Infrastructure", () => {
  const columns = [
    { key: "name", header: "Student Name" },
    { key: "id", header: "Student ID" },
    { key: "amount", header: "Amount" },
  ];

  const data = [
    { name: "Kofi Mensah", id: "SCH/2025/0001", amount: "1500.00" },
    { name: "Ama Owusu", id: "SCH/2025/0002", amount: "1200.00" },
    { name: "Kwame Asante", id: "SCH/2025/0003", amount: "1500.00" },
  ];

  describe("CSV export", () => {
    it("should generate valid CSV buffer", () => {
      const buffer = generateExport({
        filename: "test",
        columns,
        data,
        format: "csv",
      });

      expect(buffer).toBeInstanceOf(Buffer);
      const csv = buffer.toString("utf-8");
      expect(csv).toContain("Student Name");
      expect(csv).toContain("Student ID");
      expect(csv).toContain("Amount");
      expect(csv).toContain("Kofi Mensah");
      expect(csv).toContain("SCH/2025/0001");
    });

    it("should handle empty data", () => {
      const buffer = generateExport({
        filename: "empty",
        columns,
        data: [],
        format: "csv",
      });

      expect(buffer).toBeInstanceOf(Buffer);
      const csv = buffer.toString("utf-8");
      // Should have at least headers or be empty
      expect(csv).toBeDefined();
    });
  });

  describe("Excel export", () => {
    it("should generate valid XLSX buffer", () => {
      const buffer = generateExport({
        filename: "test",
        columns,
        data,
        format: "xlsx",
        sheetName: "Students",
      });

      expect(buffer).toBeInstanceOf(Buffer);
      // XLSX files start with PK (zip header)
      expect(buffer[0]).toBe(0x50); // P
      expect(buffer[1]).toBe(0x4b); // K
    });

    it("should handle custom sheet name", () => {
      const buffer = generateExport({
        filename: "fees",
        columns,
        data,
        format: "xlsx",
        sheetName: "Fee Report",
      });

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });
  });

  describe("Column transforms", () => {
    it("should apply transform functions", () => {
      const columnsWithTransform = [
        { key: "name", header: "Name" },
        {
          key: "amount",
          header: "Amount (GHS)",
          transform: (v: unknown) => `GHS ${Number(v).toFixed(2)}`,
        },
      ];

      const buffer = generateExport({
        filename: "test",
        columns: columnsWithTransform,
        data: [{ name: "Test", amount: 1500 }],
        format: "csv",
      });

      const csv = buffer.toString("utf-8");
      expect(csv).toContain("GHS 1500.00");
    });
  });

  describe("Content types", () => {
    it("should return correct CSV content type", () => {
      expect(getExportContentType("csv")).toBe("text/csv");
    });

    it("should return correct XLSX content type", () => {
      expect(getExportContentType("xlsx")).toContain("spreadsheetml");
    });
  });

  describe("File extensions", () => {
    it("should return csv extension", () => {
      expect(getExportExtension("csv")).toBe("csv");
    });

    it("should return xlsx extension", () => {
      expect(getExportExtension("xlsx")).toBe("xlsx");
    });
  });
});
