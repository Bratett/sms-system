import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const DEFAULT_CATALOG: Array<{
  name: string;
  isRequired: boolean;
  expiryMonths: number | null;
  appliesTo: "ALL" | "BOARDING_ONLY" | "DAY_ONLY";
  sortOrder: number;
}> = [
  { name: "Birth Certificate", isRequired: true, expiryMonths: null, appliesTo: "ALL", sortOrder: 0 },
  { name: "JHS Report Card", isRequired: true, expiryMonths: null, appliesTo: "ALL", sortOrder: 1 },
  { name: "Placement Letter", isRequired: true, expiryMonths: null, appliesTo: "ALL", sortOrder: 2 },
  { name: "NHIS Card", isRequired: true, expiryMonths: 12, appliesTo: "ALL", sortOrder: 3 },
  { name: "Medical Clearance", isRequired: true, expiryMonths: 12, appliesTo: "BOARDING_ONLY", sortOrder: 4 },
  { name: "Passport Photo", isRequired: true, expiryMonths: null, appliesTo: "ALL", sortOrder: 5 },
  { name: "Guardian ID", isRequired: true, expiryMonths: null, appliesTo: "ALL", sortOrder: 6 },
  { name: "Other", isRequired: false, expiryMonths: null, appliesTo: "ALL", sortOrder: 9999 },
];

async function main() {
  const schools = await db.school.findMany();
  for (const school of schools) {
    for (const type of DEFAULT_CATALOG) {
      await db.documentType.upsert({
        where: { schoolId_name: { schoolId: school.id, name: type.name } },
        update: {},
        create: { schoolId: school.id, ...type },
      });
    }
    console.log(`Seeded catalog for ${school.id}`);
  }
}

main().then(() => db.$disconnect());
