/**
 * Comprehensive demo seed for a Ghanaian senior high school.
 *
 * Builds on top of the base seed (roles, permissions, default school + admin
 * user already exist). Adds:
 *
 *   • Academic year "2025/2026" with 3 terms and a realistic calendar.
 *   • Departments + programmes (General Science, General Arts, Business,
 *     Home Economics, Visual Arts, Technical).
 *   • 12 classes (SHS 1-3 × 4 programmes) with 2 arms each, ≈ 240 students.
 *   • 18 staff (headmaster, bursar, housemasters, teachers) with user
 *     accounts + role bindings.
 *   • Subjects core + programme-specific.
 *   • Fee structures per term with items; generated StudentBills; sample
 *     payments representing ~70% collection rate.
 *   • Attendance records for the last 10 school days.
 *   • A handful of dunning policies, marks, terminal results.
 *   • Boarding: 2 dormitories, beds, ~60 boarding students allocated.
 *   • Inventory: a store, 30 items, one PO+GRN+SupplierInvoice chain.
 *   • Item-bank sample (10 questions, one READY paper).
 *
 * Safe to re-run: every call site upserts or skips-if-exists so repeated
 * `db:seed:demo` runs converge on the same demo state.
 *
 * Run:  npm run db:seed:demo
 */

import { PrismaClient, Prisma } from "@prisma/client";
import { computeStudentRiskProfiles } from "../../../src/lib/ai/analytics-engine";
import { MALE_FIRST, FEMALE_FIRST, SURNAMES, STAFF_PROFESSIONAL, pick, makeRng } from "./names";
import { seedDemoLedger } from "./ledger";

const db = new PrismaClient();
const rng = makeRng(42);

const SCHOOL_ID = "default-school";

async function main() {
  const school = await db.school.findUnique({ where: { id: SCHOOL_ID } });
  if (!school) {
    console.error(
      `❌ default school (id=${SCHOOL_ID}) not found. Run 'npm run db:seed' first.`,
    );
    process.exit(1);
  }
  console.log(`▶ Demo seed for "${school.name}"\n`);

  const academicYear = await upsertAcademicYear();
  const terms = await upsertTerms(academicYear.id);
  console.log(`✓ Academic year + ${terms.length} terms ready\n`);

  const departments = await upsertDepartments();
  const programmes = await upsertProgrammes();
  const subjects = await upsertSubjects();
  console.log(`✓ ${departments.length} depts · ${programmes.length} programmes · ${subjects.length} subjects\n`);

  const classes = await upsertClassesAndArms(academicYear.id, programmes);
  console.log(`✓ ${classes.arms.length} class arms across ${classes.classes.length} classes\n`);

  const staff = await upsertStaff(departments);
  console.log(`✓ ${staff.length} staff users created\n`);

  const students = await upsertStudents(classes.arms, academicYear.id, terms[0].id);
  console.log(`✓ ${students.length} students enrolled\n`);

  const feeStructures = await upsertFeeStructures(academicYear.id, terms);
  console.log(`✓ ${feeStructures.length} fee structures\n`);

  const bills = await generateBills(students, feeStructures, terms, academicYear.id);
  console.log(`✓ ${bills.length} bills generated\n`);

  await recordSamplePayments(bills);
  console.log(`✓ Sample payments recorded (target ~70% collection)\n`);

  await seedAttendance(students, classes.arms);
  console.log(`✓ Attendance for last 10 school days\n`);

  await seedMarks(students, subjects, classes.arms, academicYear.id, terms[0].id);
  console.log(`✓ Sample marks + terminal results\n`);

  await seedBoarding(students, terms[0].id, academicYear.id);
  console.log(`✓ Boarding allocations\n`);

  await seedInventory();
  console.log(`✓ Inventory + supplier invoice chain\n`);

  await seedItemBank(subjects);
  console.log(`✓ Item bank\n`);

  await seedDunningPolicy();
  console.log(`✓ Dunning policy\n`);

  await seedRiskProfiles(academicYear.id, terms[0].id);
  console.log(`✓ Risk profiles\n`);

  await seedDemoLedger(db);
  console.log(`✓ IPSAS ledger backfill + demo data\n`);

  console.log("✅ Demo seed complete.\n");
}

// ─── Risk profiles ─────────────────────────────────────────────────

async function seedRiskProfiles(academicYearId: string, termId: string) {
  // Lean on the existing analytics engine to compute risk for every active
  // enrollment. The engine is pure (returns assessments), so we persist
  // them here the same way `computeRiskProfilesAction` does — by upsert.
  const assessments = await computeStudentRiskProfiles(
    SCHOOL_ID,
    academicYearId,
    termId,
  );
  for (const a of assessments) {
    await db.studentRiskProfile.upsert({
      where: {
        studentId_academicYearId_termId: {
          studentId: a.studentId,
          academicYearId,
          termId,
        },
      },
      create: {
        studentId: a.studentId,
        schoolId: SCHOOL_ID,
        academicYearId,
        termId,
        riskScore: a.riskScore,
        riskLevel: a.riskLevel,
        factors: a.factors as unknown as Prisma.InputJsonValue,
        recommendations: a.recommendations as unknown as Prisma.InputJsonValue,
        performanceTrend: a.performanceTrend,
        predictedAverage: a.predictedAverage,
      },
      update: {
        riskScore: a.riskScore,
        riskLevel: a.riskLevel,
        factors: a.factors as unknown as Prisma.InputJsonValue,
        recommendations: a.recommendations as unknown as Prisma.InputJsonValue,
        performanceTrend: a.performanceTrend,
        predictedAverage: a.predictedAverage,
      },
    });
  }
  console.log(`  ${assessments.length} risk profiles computed`);
}

// ─── Academic Year + Terms ──────────────────────────────────────────

async function upsertAcademicYear() {
  const name = "2025/2026";
  const existing = await db.academicYear.findFirst({
    where: { schoolId: SCHOOL_ID, name },
  });
  if (existing) return existing;
  return db.academicYear.create({
    data: {
      schoolId: SCHOOL_ID,
      name,
      startDate: new Date("2025-09-01"),
      endDate: new Date("2026-07-31"),
      status: "ACTIVE",
      isCurrent: true,
    },
  });
}

async function upsertTerms(academicYearId: string) {
  const config = [
    { name: "Term 1", termNumber: 1, startDate: "2025-09-08", endDate: "2025-12-12" },
    { name: "Term 2", termNumber: 2, startDate: "2026-01-12", endDate: "2026-04-03" },
    { name: "Term 3", termNumber: 3, startDate: "2026-04-27", endDate: "2026-07-24" },
  ];
  const out = [];
  for (const t of config) {
    const existing = await db.term.findFirst({
      where: { schoolId: SCHOOL_ID, academicYearId, name: t.name },
    });
    out.push(
      existing ??
        (await db.term.create({
          data: {
            schoolId: SCHOOL_ID,
            academicYearId,
            name: t.name,
            termNumber: t.termNumber,
            startDate: new Date(t.startDate),
            endDate: new Date(t.endDate),
            status: t.termNumber === 2 ? "ACTIVE" : "COMPLETED",
            isCurrent: t.termNumber === 2,
          },
        })),
    );
  }
  return out;
}

// ─── Departments + Programmes + Subjects ──────────────────────────

const DEPT_DEFS = [
  { name: "Science Department", code: "SCI" },
  { name: "Arts Department", code: "ART" },
  { name: "Business Department", code: "BUS" },
  { name: "Home Economics Department", code: "HOME" },
  { name: "Administration", code: "ADM" },
];

async function upsertDepartments() {
  const out = [];
  for (const d of DEPT_DEFS) {
    out.push(
      await db.department.upsert({
        where: { schoolId_name: { schoolId: SCHOOL_ID, name: d.name } },
        update: {},
        create: { schoolId: SCHOOL_ID, name: d.name, code: d.code },
      }),
    );
  }
  return out;
}

const PROGRAMME_DEFS = [
  { name: "General Science", code: "SCI", duration: 3 },
  { name: "General Arts", code: "ART", duration: 3 },
  { name: "Business", code: "BUS", duration: 3 },
  { name: "Home Economics", code: "HOME", duration: 3 },
];

async function upsertProgrammes() {
  const out = [];
  for (const p of PROGRAMME_DEFS) {
    const existing = await db.programme.findFirst({
      where: { schoolId: SCHOOL_ID, name: p.name },
    });
    if (existing) {
      out.push(existing);
      continue;
    }
    out.push(
      await db.programme.create({
        data: {
          schoolId: SCHOOL_ID,
          name: p.name,
          code: p.code,
          duration: p.duration,
          status: "ACTIVE",
        },
      }),
    );
  }
  return out;
}

const SUBJECT_DEFS = [
  // Core (all programmes)
  { name: "English Language", code: "ENG", type: "CORE" as const },
  { name: "Mathematics", code: "MAT", type: "CORE" as const },
  { name: "Integrated Science", code: "INS", type: "CORE" as const },
  { name: "Social Studies", code: "SOC", type: "CORE" as const },
  // Science
  { name: "Physics", code: "PHY", type: "ELECTIVE" as const },
  { name: "Chemistry", code: "CHE", type: "ELECTIVE" as const },
  { name: "Biology", code: "BIO", type: "ELECTIVE" as const },
  { name: "Elective Mathematics", code: "EMAT", type: "ELECTIVE" as const },
  // Arts
  { name: "Literature in English", code: "LIT", type: "ELECTIVE" as const },
  { name: "Government", code: "GOV", type: "ELECTIVE" as const },
  { name: "History", code: "HIS", type: "ELECTIVE" as const },
  { name: "Geography", code: "GEO", type: "ELECTIVE" as const },
  // Business
  { name: "Economics", code: "ECO", type: "ELECTIVE" as const },
  { name: "Accounting", code: "ACC", type: "ELECTIVE" as const },
  { name: "Business Management", code: "BSM", type: "ELECTIVE" as const },
  // Home Ec
  { name: "Food & Nutrition", code: "FN", type: "ELECTIVE" as const },
  { name: "Clothing & Textiles", code: "CT", type: "ELECTIVE" as const },
];

async function upsertSubjects() {
  const out = [];
  for (const s of SUBJECT_DEFS) {
    out.push(
      await db.subject.upsert({
        where: { schoolId_name: { schoolId: SCHOOL_ID, name: s.name } },
        update: {},
        create: { schoolId: SCHOOL_ID, name: s.name, code: s.code, type: s.type },
      }),
    );
  }
  return out;
}

// ─── Classes + Class Arms ──────────────────────────────────────────

async function upsertClassesAndArms(
  academicYearId: string,
  programmes: Array<{ id: string; name: string; code: string | null }>,
) {
  const classes: { id: string; name: string; programmeId: string; yearGroup: number }[] = [];
  const arms: { id: string; classId: string; name: string }[] = [];

  for (const p of programmes) {
    for (const yearGroup of [1, 2, 3]) {
      const name = `SHS ${yearGroup} ${p.name}`;
      const cls = await db.class.upsert({
        where: {
          schoolId_name_academicYearId: {
            schoolId: SCHOOL_ID,
            name,
            academicYearId,
          },
        },
        update: {},
        create: {
          schoolId: SCHOOL_ID,
          name,
          programmeId: p.id,
          academicYearId,
          yearGroup,
          code: `${p.code}-${yearGroup}`,
          maxCapacity: 40,
          status: "ACTIVE",
        },
      });
      classes.push({ id: cls.id, name: cls.name, programmeId: p.id, yearGroup });

      for (const armName of ["A", "B"]) {
        const arm = await db.classArm.upsert({
          where: { classId_name: { classId: cls.id, name: armName } },
          update: {},
          create: {
            classId: cls.id,
            schoolId: SCHOOL_ID,
            name: armName,
            capacity: 40,
            status: "ACTIVE",
          },
        });
        arms.push({ id: arm.id, classId: cls.id, name: arm.name });
      }
    }
  }
  return { classes, arms };
}

// ─── Staff ──────────────────────────────────────────────────────────

async function upsertStaff(
  departments: Array<{ id: string; code: string | null; name: string }>,
) {
  const out: Array<{ id: string; userId: string; firstName: string; lastName: string; role: string }> = [];
  const admDept = departments.find((d) => d.code === "ADM")!;
  const deptByRole: Record<string, string> = {
    teacher: departments.find((d) => d.code === "SCI")!.id,
    headmaster: admDept.id,
    assistant_headmaster_academic: admDept.id,
    assistant_headmaster_admin: admDept.id,
    bursar: admDept.id,
    house_master: admDept.id,
  };

  for (const person of STAFF_PROFESSIONAL) {
    const username = slugify(`${person.first}.${person.last}`);
    const email = `${username}@school.edu.gh`;

    // upsert user — skip if already exists from previous run
    let user = await db.user.findUnique({ where: { username } });
    if (!user) {
      const passwordHash = "$2a$12$qWj.sA1cLPrWnmK9cT0r1eJf7v5E2rBp8FCmwjb5KHRr0i0k.UHwG"; // bcrypt('Demo@123')
      user = await db.user.create({
        data: {
          username,
          email,
          firstName: person.first,
          lastName: person.last,
          passwordHash,
          status: "ACTIVE",
        },
      });
    }

    // Associate user with school
    await db.userSchool.upsert({
      where: { userId_schoolId: { userId: user.id, schoolId: SCHOOL_ID } },
      update: {},
      create: { userId: user.id, schoolId: SCHOOL_ID, isDefault: true },
    });

    // Assign role
    const role = await db.role.findUnique({ where: { name: person.role } });
    if (role) {
      await db.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: role.id } },
        update: {},
        create: { userId: user.id, roleId: role.id },
      });
    }

    // Staff profile
    const staff = await db.staff.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        schoolId: SCHOOL_ID,
        staffId: `STF-${out.length.toString().padStart(4, "0")}`,
        firstName: person.first,
        lastName: person.last,
        email,
        phone: `+233 24 ${(1000 + out.length).toString().padStart(4, "0")}xx`,
        staffType: person.role === "teacher" ? "TEACHING" : "NON_TEACHING",
        status: "ACTIVE",
        gender: person.first.startsWith("Mrs") ? "FEMALE" : "MALE",
        dateOfBirth: new Date(1975 + Math.floor(rng() * 20), Math.floor(rng() * 12), 1),
      },
    });
    // Departmental binding via Employment (no unique on staffId — use findFirst)
    const existingEmployment = await db.employment.findFirst({
      where: { staffId: staff.id, schoolId: SCHOOL_ID },
      select: { id: true },
    });
    if (!existingEmployment) {
      await db.employment.create({
        data: {
          schoolId: SCHOOL_ID,
          staffId: staff.id,
          departmentId: deptByRole[person.role] ?? admDept.id,
          position: person.role,
          startDate: new Date("2022-09-01"),
          appointmentType: "PERMANENT",
          status: "ACTIVE",
        },
      });
    }

    out.push({
      id: staff.id,
      userId: user.id,
      firstName: person.first,
      lastName: person.last,
      role: person.role,
    });
  }
  return out;
}

// ─── Students ──────────────────────────────────────────────────────

async function upsertStudents(
  arms: Array<{ id: string; classId: string; name: string }>,
  academicYearId: string,
  firstTermId: string,
) {
  const TARGET = 240;
  const existing = await db.student.count({ where: { schoolId: SCHOOL_ID } });
  if (existing >= TARGET) {
    console.log(`  ↷ ${existing} students already exist, skipping`);
    return db.student.findMany({
      where: { schoolId: SCHOOL_ID },
      take: TARGET,
    });
  }

  const created: Array<{ id: string; studentId: string; classArmId: string }> = [];
  let counter = existing;

  for (let i = 0; i < TARGET - existing; i++) {
    counter++;
    const isFemale = rng() < 0.5;
    const first = pick(isFemale ? FEMALE_FIRST : MALE_FIRST, rng);
    const last = pick(SURNAMES, rng);
    const code = `GHS-${counter.toString().padStart(5, "0")}`;
    const arm = arms[counter % arms.length];
    const isBoarding = rng() < 0.35;
    const dob = new Date(2006 + Math.floor(rng() * 4), Math.floor(rng() * 12), Math.floor(rng() * 28) + 1);

    const student = await db.student.create({
      data: {
        schoolId: SCHOOL_ID,
        studentId: code,
        firstName: first,
        lastName: last,
        gender: isFemale ? "FEMALE" : "MALE",
        dateOfBirth: dob,
        boardingStatus: isBoarding ? "BOARDING" : "DAY",
        status: "ACTIVE",
        enrollmentDate: new Date("2025-09-05"),
      },
    });

    await db.enrollment.create({
      data: {
        studentId: student.id,
        classArmId: arm.id,
        schoolId: SCHOOL_ID,
        academicYearId,
        termId: firstTermId,
        status: "ACTIVE",
      },
    });

    // Create primary guardian
    const guardianFirst = pick(MALE_FIRST, rng);
    const guardianLast = last;
    const guardian = await db.guardian.create({
      data: {
        schoolId: SCHOOL_ID,
        firstName: guardianFirst,
        lastName: guardianLast,
        phone: `+233 24 ${(3000 + counter).toString().padStart(4, "0")}xx`,
        email: `${slugify(guardianFirst + "." + guardianLast)}.${counter}@demo.gh`,
        relationship: "FATHER",
      },
    });
    await db.studentGuardian.create({
      data: {
        schoolId: SCHOOL_ID,
        studentId: student.id,
        guardianId: guardian.id,
        isPrimary: true,
      },
    });

    created.push({ id: student.id, studentId: code, classArmId: arm.id });
  }
  return created;
}

// ─── Fee Structures + Bills ──────────────────────────────────────

async function upsertFeeStructures(
  academicYearId: string,
  terms: Array<{ id: string; name: string }>,
) {
  const out = [];
  for (const term of terms) {
    const existing = await db.feeStructure.findFirst({
      where: { schoolId: SCHOOL_ID, termId: term.id, name: { contains: "Standard" } },
    });
    if (existing) {
      out.push(existing);
      continue;
    }
    const fs = await db.feeStructure.create({
      data: {
        schoolId: SCHOOL_ID,
        academicYearId,
        termId: term.id,
        name: `Standard Fees — ${term.name}`,
        status: "ACTIVE",
      },
    });
    // line items
    const items = [
      { name: "Tuition", code: "TUI", amount: 800, isOptional: false },
      { name: "Feeding", code: "FEED", amount: 400, isOptional: false },
      { name: "PTA Levy", code: "PTA", amount: 50, isOptional: false },
      { name: "Exam Fee", code: "EXM", amount: 80, isOptional: false },
      { name: "Boarding Fee", code: "BRD", amount: 600, isOptional: true },
    ];
    await db.feeItem.createMany({
      data: items.map((i) => ({
        schoolId: SCHOOL_ID,
        feeStructureId: fs.id,
        name: i.name,
        code: i.code,
        amount: i.amount,
        isOptional: i.isOptional,
      })),
    });
    out.push(fs);
  }
  return out;
}

async function generateBills(
  students: Array<{ id: string }>,
  feeStructures: Array<{ id: string; termId: string; academicYearId: string }>,
  terms: Array<{ id: string }>,
  academicYearId: string,
) {
  const bills: Array<{ id: string; studentId: string; balanceAmount: number }> = [];
  const termIds = new Set(terms.map((t) => t.id));
  const today = new Date();
  // Stagger dueDates across 3 cohorts so a single dunning-engine run lights
  // up every stage of the Standard Ladder (day 7, 14, 30). Without this
  // every bill falls into the same stage and operators never see the ladder
  // progress. Cohort rotates per bill-creation counter.
  const staggerOffsets = [35, 20, 10]; // days past today
  const relativeDueDate = (i: number): Date => {
    const d = new Date(today);
    d.setDate(d.getDate() - staggerOffsets[i % staggerOffsets.length]);
    return d;
  };
  let cohortCounter = 0;

  for (const student of students) {
    for (const fs of feeStructures) {
      if (!termIds.has(fs.termId)) continue;

      const existing = await db.studentBill.findUnique({
        where: {
          studentId_feeStructureId: { studentId: student.id, feeStructureId: fs.id },
        },
      });
      if (existing) {
        bills.push({
          id: existing.id,
          studentId: student.id,
          balanceAmount: Number(existing.balanceAmount),
        });
        continue;
      }

      const items = await db.feeItem.findMany({ where: { feeStructureId: fs.id } });
      const student2 = await db.student.findUnique({ where: { id: student.id } });
      const isBoarding = student2?.boardingStatus === "BOARDING";
      const applicable = items.filter((i) => !i.isOptional || (i.code === "BRD" && isBoarding));
      const total = applicable.reduce((s, i) => s + Number(i.amount), 0);

      const bill = await db.studentBill.create({
        data: {
          schoolId: SCHOOL_ID,
          studentId: student.id,
          feeStructureId: fs.id,
          termId: fs.termId,
          academicYearId,
          totalAmount: total,
          balanceAmount: total,
          dueDate: relativeDueDate(cohortCounter++),
          status: "UNPAID",
        },
      });
      await db.studentBillItem.createMany({
        data: applicable.map((i) => ({
          schoolId: SCHOOL_ID,
          studentBillId: bill.id,
          feeItemId: i.id,
          amount: i.amount,
        })),
      });
      bills.push({ id: bill.id, studentId: student.id, balanceAmount: total });
    }
  }
  return bills;
}

async function recordSamplePayments(
  bills: Array<{ id: string; studentId: string; balanceAmount: number }>,
) {
  let recorded = 0;
  for (const bill of bills) {
    if (rng() >= 0.7) continue; // 70% of bills see a payment
    const partial = rng() < 0.4;
    const amount = partial
      ? Math.round(bill.balanceAmount * (0.4 + rng() * 0.3))
      : bill.balanceAmount;
    if (amount <= 0) continue;

    try {
      await db.$transaction(async (tx) => {
        const current = await tx.studentBill.findUnique({ where: { id: bill.id } });
        if (!current) return;
        if (Number(current.balanceAmount) <= 0) return;

        const payment = await tx.payment.create({
          data: {
            schoolId: SCHOOL_ID,
            studentBillId: bill.id,
            studentId: bill.studentId,
            amount,
            paymentMethod: rng() < 0.6 ? "MOBILE_MONEY" : "BANK_TRANSFER",
            referenceNumber: `DEMO-${recorded.toString().padStart(5, "0")}`,
            receivedBy: "seed",
            status: "CONFIRMED",
          },
        });
        const newPaid = Number(current.paidAmount) + amount;
        const balance = Number(current.totalAmount) - newPaid;
        await tx.studentBill.update({
          where: { id: bill.id },
          data: {
            paidAmount: newPaid,
            balanceAmount: Math.max(balance, 0),
            status: balance <= 0 ? "PAID" : "PARTIAL",
          },
        });
        await tx.receipt.create({
          data: {
            schoolId: SCHOOL_ID,
            paymentId: payment.id,
            receiptNumber: `RCP/2025/DM/${recorded.toString().padStart(6, "0")}`,
          },
        });
      });
      recorded++;
    } catch {
      // next bill
    }
  }
  console.log(`  recorded ${recorded} payments`);
}

// ─── Attendance ────────────────────────────────────────────────────

async function seedAttendance(
  students: Array<{ id: string }>,
  arms: Array<{ id: string }>,
) {
  // Build a classArmId map from active enrollments.
  const enrollments = await db.enrollment.findMany({
    where: { schoolId: SCHOOL_ID, status: "ACTIVE" },
    select: { studentId: true, classArmId: true },
  });
  const armOf = new Map(enrollments.map((e) => [e.studentId, e.classArmId]));
  const studentsByArm = new Map<string, string[]>();
  for (const [studentId, armId] of armOf.entries()) {
    const list = studentsByArm.get(armId) ?? [];
    list.push(studentId);
    studentsByArm.set(armId, list);
  }

  // Collect the last 10 weekdays.
  const days: Date[] = [];
  const cursor = new Date();
  while (days.length < 10) {
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() - 1);
  }

  let created = 0;
  for (const day of days) {
    for (const armId of studentsByArm.keys()) {
      // One AttendanceRegister per (classArm, day) — DAILY, null period.
      const existing = await db.attendanceRegister.findFirst({
        where: { classArmId: armId, date: day, type: "DAILY", periodId: null },
        select: { id: true },
      });
      const register =
        existing ??
        (await db.attendanceRegister.create({
          data: {
            schoolId: SCHOOL_ID,
            classArmId: armId,
            date: day,
            type: "DAILY",
            takenBy: "seed",
            status: "CLOSED",
          },
        }));

      for (const studentId of studentsByArm.get(armId) ?? []) {
        const r = rng();
        const status = r < 0.88 ? "PRESENT" : r < 0.94 ? "LATE" : r < 0.97 ? "ABSENT" : "EXCUSED";
        try {
          await db.attendanceRecord.create({
            data: {
              registerId: register.id,
              schoolId: SCHOOL_ID,
              studentId,
              status: status as never,
            },
          });
          created++;
        } catch {
          // uniqueness on (registerId, studentId) — skip
        }
      }
    }
  }
  void arms;
  console.log(`  ${created} attendance rows`);
}

// ─── Marks + Terminal Results ──────────────────────────────────────

async function seedMarks(
  students: Array<{ id: string }>,
  subjects: Array<{ id: string; name: string }>,
  arms: Array<{ id: string; classId: string }>,
  academicYearId: string,
  termId: string,
) {
  const armOfStudent = new Map<string, string>();
  const enrollments = await db.enrollment.findMany({
    where: { schoolId: SCHOOL_ID, status: "ACTIVE" },
    select: { studentId: true, classArmId: true },
  });
  for (const e of enrollments) armOfStudent.set(e.studentId, e.classArmId);

  // Ensure one AssessmentType exists
  const assessment = await db.assessmentType.upsert({
    where: { schoolId_name_termId: { schoolId: SCHOOL_ID, name: "Mid-Term", termId } },
    update: {},
    create: {
      schoolId: SCHOOL_ID,
      name: "Mid-Term",
      code: "MID",
      weight: 30,
      maxScore: 100,
      termId,
      category: "MIDTERM",
    },
  });

  const coreSubjects = subjects.slice(0, 4); // first 4 are cores
  let inserted = 0;
  for (const student of students.slice(0, 80)) {
    const armId = armOfStudent.get(student.id);
    if (!armId) continue;
    for (const subj of coreSubjects) {
      const score = 35 + Math.floor(rng() * 60); // 35..95
      try {
        await db.mark.create({
          data: {
            schoolId: SCHOOL_ID,
            studentId: student.id,
            subjectId: subj.id,
            assessmentTypeId: assessment.id,
            classArmId: armId,
            termId,
            academicYearId,
            score,
            maxScore: 100,
            enteredBy: "seed",
            status: "APPROVED",
            approvedBy: "seed",
            approvedAt: new Date(),
          },
        });
        inserted++;
      } catch {
        // duplicate
      }
    }
  }
  // Terminal results for a subset
  for (const student of students.slice(0, 40)) {
    const armId = armOfStudent.get(student.id);
    if (!armId) continue;
    const avg = 40 + rng() * 50;
    try {
      await db.terminalResult.upsert({
        where: {
          studentId_termId_academicYearId: {
            studentId: student.id,
            termId,
            academicYearId,
          },
        },
        update: {},
        create: {
          schoolId: SCHOOL_ID,
          studentId: student.id,
          classArmId: armId,
          termId,
          academicYearId,
          averageScore: Math.round(avg * 100) / 100,
          totalScore: Math.round(avg * coreSubjects.length * 100) / 100,
          overallGrade: avg >= 80 ? "A" : avg >= 70 ? "B" : avg >= 60 ? "C" : avg >= 50 ? "D" : "E",
        },
      });
    } catch {
      // already exists
    }
  }
  console.log(`  ${inserted} marks + 40 terminal results`);
  void arms;
}

// ─── Boarding ─────────────────────────────────────────────────────

async function seedBoarding(
  _students: Array<{ id: string }>,
  firstTermId: string,
  academicYearId: string,
) {
  // Build the full Hostel → Dormitory → Bed → BedAllocation chain so the
  // boarding module pages render real data on the demo tenant. Idempotent:
  // upserts at each level and skips allocations that already exist.

  const HOSTELS = [
    { name: "Osagyefo House", gender: "MALE" as const },
    { name: "Yaa Asantewaa House", gender: "FEMALE" as const },
  ];
  const WINGS = ["A Wing", "B Wing"];
  const BEDS_PER_DORM = 30;

  const hostelByGender: Record<"MALE" | "FEMALE", string[]> = { MALE: [], FEMALE: [] };

  for (const h of HOSTELS) {
    const hostel = await db.hostel.upsert({
      where: { schoolId_name: { schoolId: SCHOOL_ID, name: h.name } },
      update: {},
      create: {
        schoolId: SCHOOL_ID,
        name: h.name,
        gender: h.gender,
        capacity: WINGS.length * BEDS_PER_DORM,
        status: "ACTIVE",
      },
    });

    for (const wingName of WINGS) {
      const dorm = await db.dormitory.upsert({
        where: { hostelId_name: { hostelId: hostel.id, name: wingName } },
        update: {},
        create: {
          hostelId: hostel.id,
          schoolId: SCHOOL_ID,
          name: wingName,
          capacity: BEDS_PER_DORM,
          status: "ACTIVE",
        },
      });

      for (let i = 1; i <= BEDS_PER_DORM; i++) {
        const bedNumber = `B${i.toString().padStart(2, "0")}`;
        await db.bed.upsert({
          where: { dormitoryId_bedNumber: { dormitoryId: dorm.id, bedNumber } },
          update: {},
          create: {
            dormitoryId: dorm.id,
            schoolId: SCHOOL_ID,
            bedNumber,
            status: "AVAILABLE",
          },
        });
      }
    }
    hostelByGender[h.gender].push(hostel.id);
  }

  // Allocate boarding students to beds, gender-matched.
  let allocated = 0;
  for (const gender of ["MALE", "FEMALE"] as const) {
    const candidates = await db.student.findMany({
      where: { schoolId: SCHOOL_ID, boardingStatus: "BOARDING", gender },
      select: { id: true },
    });
    if (candidates.length === 0) continue;

    const hostelIds = hostelByGender[gender];
    const availableBeds = await db.bed.findMany({
      where: {
        status: "AVAILABLE",
        dormitory: { hostelId: { in: hostelIds } },
      },
      orderBy: [{ dormitoryId: "asc" }, { bedNumber: "asc" }],
      select: { id: true },
    });

    let bedIdx = 0;
    for (const student of candidates) {
      const existing = await db.bedAllocation.findUnique({
        where: { studentId_termId: { studentId: student.id, termId: firstTermId } },
      });
      if (existing) continue;
      if (bedIdx >= availableBeds.length) break;

      const bed = availableBeds[bedIdx++];
      await db.$transaction(async (tx) => {
        await tx.bedAllocation.create({
          data: {
            schoolId: SCHOOL_ID,
            bedId: bed.id,
            studentId: student.id,
            termId: firstTermId,
            academicYearId,
            allocatedBy: "seed",
            status: "ACTIVE",
          },
        });
        await tx.bed.update({ where: { id: bed.id }, data: { status: "OCCUPIED" } });
      });
      allocated++;
    }
  }

  const hostelCount = HOSTELS.length;
  const dormCount = hostelCount * WINGS.length;
  const bedCount = dormCount * BEDS_PER_DORM;
  console.log(
    `  ${hostelCount} hostels · ${dormCount} dorms · ${bedCount} beds · ${allocated} allocations`,
  );
}

// ─── Inventory + Supplier Invoice ──────────────────────────────────

async function seedInventory() {
  const store = await db.store.upsert({
    where: { schoolId_name: { schoolId: SCHOOL_ID, name: "Main Store" } },
    update: {},
    create: { schoolId: SCHOOL_ID, name: "Main Store", status: "ACTIVE" },
  });
  const categories = ["Stationery", "Sanitary", "Food Supplies", "Uniforms"];
  for (const c of categories) {
    await db.itemCategory.upsert({
      where: { schoolId_name: { schoolId: SCHOOL_ID, name: c } },
      update: {},
      create: { schoolId: SCHOOL_ID, name: c },
    });
  }
  const catStationery = await db.itemCategory.findFirst({
    where: { schoolId: SCHOOL_ID, name: "Stationery" },
  });
  const itemsDef = [
    { name: "Exercise Books (40 leaves)", qty: 500, price: 3 },
    { name: "Blue Pens", qty: 800, price: 1.5 },
    { name: "Chalk (box)", qty: 120, price: 10 },
    { name: "Printer Paper (ream)", qty: 60, price: 40 },
    { name: "Toilet Paper (pack)", qty: 200, price: 20 },
  ];
  for (const it of itemsDef) {
    await db.storeItem.upsert({
      where: { storeId_name: { storeId: store.id, name: it.name } },
      update: {},
      create: {
        storeId: store.id,
        categoryId: catStationery?.id,
        name: it.name,
        quantity: it.qty,
        reorderLevel: 50,
        unitPrice: it.price,
        status: "ACTIVE",
      },
    });
  }

  const supplier = await db.supplier.upsert({
    where: { schoolId_name: { schoolId: SCHOOL_ID, name: "Pentacorp Supplies" } },
    update: {},
    create: { schoolId: SCHOOL_ID, name: "Pentacorp Supplies", status: "ACTIVE" },
  });

  const existingPo = await db.purchaseOrder.findFirst({
    where: { supplierId: supplier.id, orderNumber: "PO/2025/0001" },
  });
  if (existingPo) return;

  // Build PO → GRN → Invoice chain for 3-way match demo
  const storeItems = await db.storeItem.findMany({
    where: { storeId: store.id },
    take: 2,
  });
  const po = await db.purchaseOrder.create({
    data: {
      supplierId: supplier.id,
      orderNumber: "PO/2025/0001",
      orderedBy: "seed",
      status: "RECEIVED",
      totalAmount: new Prisma.Decimal(storeItems.reduce((s, i) => s + Number(i.unitPrice) * 10, 0)),
    },
  });
  for (const item of storeItems) {
    await db.purchaseOrderItem.create({
      data: {
        purchaseOrderId: po.id,
        storeItemId: item.id,
        quantity: 10,
        unitPrice: item.unitPrice,
        totalPrice: new Prisma.Decimal(Number(item.unitPrice) * 10),
      },
    });
  }
  const grn = await db.goodsReceived.create({
    data: {
      purchaseOrderId: po.id,
      receivedBy: "seed",
      notes: "Demo GRN",
    },
  });
  for (const item of storeItems) {
    await db.goodsReceivedItem.create({
      data: {
        goodsReceivedId: grn.id,
        storeItemId: item.id,
        quantityReceived: 10,
        condition: "Good",
      },
    });
  }
  const subTotal = storeItems.reduce((s, i) => s + Number(i.unitPrice) * 10, 0);
  const invoice = await db.supplierInvoice.create({
    data: {
      schoolId: SCHOOL_ID,
      supplierId: supplier.id,
      purchaseOrderId: po.id,
      invoiceNumber: "INV-DEMO-001",
      invoiceDate: new Date(),
      subTotal,
      taxAmount: 0,
      totalAmount: subTotal,
      status: "RECEIVED",
      receivedBy: "seed",
    },
  });
  for (const item of storeItems) {
    await db.supplierInvoiceItem.create({
      data: {
        supplierInvoiceId: invoice.id,
        schoolId: SCHOOL_ID,
        storeItemId: item.id,
        description: item.name,
        quantity: 10,
        unitPrice: item.unitPrice,
        lineTotal: new Prisma.Decimal(Number(item.unitPrice) * 10),
      },
    });
  }
}

// ─── Item Bank ─────────────────────────────────────────────────────

async function seedItemBank(subjects: Array<{ id: string; name: string }>) {
  const maths = subjects.find((s) => s.name === "Mathematics");
  if (!maths) return;
  const existing = await db.itemBankQuestion.count({
    where: { schoolId: SCHOOL_ID, subjectId: maths.id },
  });
  if (existing >= 5) return;

  const questions = [
    {
      stem: "What is 12 × 8?",
      correct: "96",
      distractors: ["84", "106", "108"],
      difficulty: "EASY" as const,
      bloom: "REMEMBER" as const,
    },
    {
      stem: "Solve for x: 3x + 5 = 20",
      correct: "5",
      distractors: ["3", "7", "15"],
      difficulty: "MEDIUM" as const,
      bloom: "APPLY" as const,
    },
    {
      stem: "The sum of the interior angles of a triangle is:",
      correct: "180°",
      distractors: ["90°", "360°", "270°"],
      difficulty: "EASY" as const,
      bloom: "REMEMBER" as const,
    },
    {
      stem: "If 2^x = 32, what is x?",
      correct: "5",
      distractors: ["4", "6", "8"],
      difficulty: "MEDIUM" as const,
      bloom: "UNDERSTAND" as const,
    },
    {
      stem: "What is the derivative of x² with respect to x?",
      correct: "2x",
      distractors: ["x", "x²/2", "1"],
      difficulty: "HARD" as const,
      bloom: "APPLY" as const,
    },
  ];
  for (const q of questions) {
    const choices = [
      { text: q.correct, isCorrect: true },
      ...q.distractors.map((t) => ({ text: t, isCorrect: false })),
    ];
    // shuffle
    choices.sort(() => rng() - 0.5);
    const created = await db.itemBankQuestion.create({
      data: {
        schoolId: SCHOOL_ID,
        subjectId: maths.id,
        stem: q.stem,
        type: "MULTIPLE_CHOICE",
        difficulty: q.difficulty,
        bloomLevel: q.bloom,
        maxScore: 1,
        status: "PUBLISHED",
        authoredBy: "seed",
      },
    });
    await db.itemBankChoice.createMany({
      data: choices.map((c, idx) => ({
        questionId: created.id,
        schoolId: SCHOOL_ID,
        text: c.text,
        isCorrect: c.isCorrect,
        order: idx,
      })),
    });
  }

  // Generate a READY paper
  const qs = await db.itemBankQuestion.findMany({
    where: { schoolId: SCHOOL_ID, subjectId: maths.id, status: "PUBLISHED" },
  });
  if (qs.length === 0) return;
  const paper = await db.itemBankPaper.create({
    data: {
      schoolId: SCHOOL_ID,
      title: "Maths Mock — Demo",
      subjectId: maths.id,
      totalScore: qs.reduce((s, q) => s + (q.maxScore ?? 1), 0),
      durationMins: 45,
      status: "READY",
      createdBy: "seed",
    },
  });
  await db.itemBankPaperQuestion.createMany({
    data: qs.map((q, i) => ({
      paperId: paper.id,
      questionId: q.id,
      schoolId: SCHOOL_ID,
      order: i + 1,
    })),
  });
}

// ─── Dunning Policy ────────────────────────────────────────────────

async function seedDunningPolicy() {
  const existing = await db.dunningPolicy.findFirst({
    where: { schoolId: SCHOOL_ID, name: "Standard Ladder" },
  });
  if (existing) return;
  const policy = await db.dunningPolicy.create({
    data: {
      schoolId: SCHOOL_ID,
      name: "Standard Ladder",
      description: "Standard 3-stage reminder + escalation for unpaid bills.",
      scope: "ALL_OUTSTANDING",
      isActive: true,
      createdBy: "seed",
    },
  });
  await db.dunningStage.createMany({
    data: [
      {
        policyId: policy.id,
        schoolId: SCHOOL_ID,
        order: 1,
        name: "Gentle reminder",
        daysOverdue: 7,
        channels: ["sms"],
        blockPortal: false,
      },
      {
        policyId: policy.id,
        schoolId: SCHOOL_ID,
        order: 2,
        name: "Warning",
        daysOverdue: 14,
        channels: ["sms", "email"],
        blockPortal: false,
      },
      {
        policyId: policy.id,
        schoolId: SCHOOL_ID,
        order: 3,
        name: "Final notice",
        daysOverdue: 30,
        channels: ["sms", "email", "in_app"],
        escalateToRole: "bursar",
        blockPortal: true,
      },
    ],
  });
}

// ─── Utilities ─────────────────────────────────────────────────────

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/dr\.\s+/g, "")
    .replace(/mrs\.\s+/g, "")
    .replace(/mr\.\s+/g, "")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

main()
  .then(async () => db.$disconnect())
  .catch(async (e) => {
    console.error("❌ Demo seed failed:", e);
    await db.$disconnect();
    process.exit(1);
  });
