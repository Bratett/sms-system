"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import type { Prisma } from "@prisma/client";

// ─── Books ─────────────────────────────────────────────────────────

export async function getBooksAction(filters?: {
  search?: string;
  category?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.LIBRARY_READ);
  if (denied) return denied;

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 25;
  const skip = (page - 1) * pageSize;

  const where: Prisma.BookWhereInput = {
    schoolId: ctx.schoolId,
    ...(filters?.category && { category: filters.category }),
    ...(filters?.status && { status: filters.status as any }),
    ...(filters?.search && {
      OR: [
        { title: { contains: filters.search, mode: "insensitive" } },
        { author: { contains: filters.search, mode: "insensitive" } },
        { isbn: { contains: filters.search, mode: "insensitive" } },
      ],
    }),
  };

  const [books, total] = await Promise.all([
    db.book.findMany({
      where,
      orderBy: { title: "asc" },
      skip,
      take: pageSize,
    }),
    db.book.count({ where }),
  ]);

  const data = books.map((book) => ({
    id: book.id,
    isbn: book.isbn,
    title: book.title,
    author: book.author,
    publisher: book.publisher,
    publicationYear: book.publicationYear,
    category: book.category,
    shelfLocation: book.shelfLocation,
    totalCopies: book.totalCopies,
    availableCopies: book.availableCopies,
    coverImageUrl: book.coverImageUrl,
    status: book.status,
    createdAt: book.createdAt,
  }));

  return { data, total, page, pageSize };
}

export async function getBookAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.LIBRARY_READ);
  if (denied) return denied;

  const book = await db.book.findUnique({
    where: { id },
    include: {
      issues: {
        orderBy: { issuedAt: "desc" },
        take: 50,
      },
    },
  });

  if (!book) {
    return { error: "Book not found." };
  }

  // Fetch borrower names
  const borrowerIds = [...new Set(book.issues.map((i) => i.borrowerId))];
  const issuedByIds = [...new Set(book.issues.map((i) => i.issuedBy))];
  const allUserIds = [...new Set([...borrowerIds, ...issuedByIds])];

  let userMap = new Map<string, string>();
  if (allUserIds.length > 0) {
    // Try students first
    const students = await db.student.findMany({
      where: { id: { in: allUserIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    students.forEach((s) => userMap.set(s.id, `${s.firstName} ${s.lastName}`));

    // Then staff/users
    const users = await db.user.findMany({
      where: { id: { in: allUserIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    users.forEach((u) => userMap.set(u.id, `${u.firstName} ${u.lastName}`));
  }

  const data = {
    id: book.id,
    isbn: book.isbn,
    title: book.title,
    author: book.author,
    publisher: book.publisher,
    publicationYear: book.publicationYear,
    category: book.category,
    shelfLocation: book.shelfLocation,
    totalCopies: book.totalCopies,
    availableCopies: book.availableCopies,
    coverImageUrl: book.coverImageUrl,
    status: book.status,
    createdAt: book.createdAt,
    issues: book.issues.map((issue) => ({
      id: issue.id,
      borrowerId: issue.borrowerId,
      borrowerName: userMap.get(issue.borrowerId) ?? "Unknown",
      borrowerType: issue.borrowerType,
      issuedBy: issue.issuedBy,
      issuedByName: userMap.get(issue.issuedBy) ?? "Unknown",
      issuedAt: issue.issuedAt,
      dueDate: issue.dueDate,
      returnedAt: issue.returnedAt,
      status: issue.status,
      fineAmount: issue.fineAmount,
      notes: issue.notes,
    })),
  };

  return { data };
}

export async function createBookAction(data: {
  isbn?: string;
  title: string;
  author: string;
  publisher?: string;
  publicationYear?: number;
  category?: string;
  shelfLocation?: string;
  totalCopies?: number;
  coverImageUrl?: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.LIBRARY_CREATE);
  if (denied) return denied;

  const totalCopies = data.totalCopies ?? 1;

  const book = await db.book.create({
    data: {
      schoolId: ctx.schoolId,
      isbn: data.isbn || null,
      title: data.title,
      author: data.author,
      publisher: data.publisher || null,
      publicationYear: data.publicationYear ?? null,
      category: data.category || null,
      shelfLocation: data.shelfLocation || null,
      totalCopies,
      availableCopies: totalCopies,
      coverImageUrl: data.coverImageUrl || null,
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "Book",
    entityId: book.id,
    module: "library",
    description: `Created book "${book.title}" by ${book.author}`,
    newData: book,
  });

  return { data: book };
}

export async function updateBookAction(
  id: string,
  data: {
    isbn?: string;
    title?: string;
    author?: string;
    publisher?: string;
    publicationYear?: number;
    category?: string;
    shelfLocation?: string;
    totalCopies?: number;
    coverImageUrl?: string;
    status?: "AVAILABLE" | "LOW_STOCK" | "OUT_OF_STOCK" | "ARCHIVED";
  },
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.LIBRARY_UPDATE);
  if (denied) return denied;

  const existing = await db.book.findUnique({ where: { id } });
  if (!existing) {
    return { error: "Book not found." };
  }

  const previousData = { ...existing };

  // If totalCopies changed, adjust availableCopies proportionally
  let availableCopies = existing.availableCopies;
  if (data.totalCopies !== undefined && data.totalCopies !== existing.totalCopies) {
    const issuedCopies = existing.totalCopies - existing.availableCopies;
    availableCopies = Math.max(0, data.totalCopies - issuedCopies);
  }

  const updated = await db.book.update({
    where: { id },
    data: {
      isbn: data.isbn !== undefined ? data.isbn || null : existing.isbn,
      title: data.title ?? existing.title,
      author: data.author ?? existing.author,
      publisher: data.publisher !== undefined ? data.publisher || null : existing.publisher,
      publicationYear: data.publicationYear !== undefined ? data.publicationYear : existing.publicationYear,
      category: data.category !== undefined ? data.category || null : existing.category,
      shelfLocation: data.shelfLocation !== undefined ? data.shelfLocation || null : existing.shelfLocation,
      totalCopies: data.totalCopies ?? existing.totalCopies,
      availableCopies,
      coverImageUrl: data.coverImageUrl !== undefined ? data.coverImageUrl || null : existing.coverImageUrl,
      status: data.status ?? existing.status,
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "UPDATE",
    entity: "Book",
    entityId: id,
    module: "library",
    description: `Updated book "${updated.title}"`,
    previousData,
    newData: updated,
  });

  return { data: updated };
}

export async function deleteBookAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.LIBRARY_DELETE);
  if (denied) return denied;

  const book = await db.book.findUnique({
    where: { id },
    include: {
      issues: {
        where: { status: { in: ["ISSUED", "OVERDUE"] } },
      },
    },
  });

  if (!book) {
    return { error: "Book not found." };
  }

  if (book.issues.length > 0) {
    return { error: "Cannot delete book with active issues. Please resolve all issues first." };
  }

  await db.book.delete({ where: { id } });

  await audit({
    userId: ctx.session.user.id,
    action: "DELETE",
    entity: "Book",
    entityId: id,
    module: "library",
    description: `Deleted book "${book.title}"`,
    previousData: book,
  });

  return { success: true };
}

// ─── Book Issues ───────────────────────────────────────────────────

export async function issueBookAction(data: {
  bookId: string;
  borrowerId: string;
  borrowerType: "STUDENT" | "STAFF";
  dueDate: Date;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.LIBRARY_CHECKOUT);
  if (denied) return denied;

  const book = await db.book.findUnique({ where: { id: data.bookId } });
  if (!book) {
    return { error: "Book not found." };
  }

  if (book.availableCopies <= 0) {
    return { error: "No copies available for issuing." };
  }

  const newAvailable = book.availableCopies - 1;
  let newStatus: "AVAILABLE" | "LOW_STOCK" | "OUT_OF_STOCK" = "AVAILABLE";
  if (newAvailable === 0) {
    newStatus = "OUT_OF_STOCK";
  } else if (newAvailable <= Math.ceil(book.totalCopies * 0.2)) {
    newStatus = "LOW_STOCK";
  }

  const [issue] = await Promise.all([
    db.bookIssue.create({
      data: {
        schoolId: ctx.schoolId,
        bookId: data.bookId,
        borrowerId: data.borrowerId,
        borrowerType: data.borrowerType,
        issuedBy: ctx.session.user.id,
        dueDate: data.dueDate,
      },
    }),
    db.book.update({
      where: { id: data.bookId },
      data: {
        availableCopies: newAvailable,
        status: newStatus,
      },
    }),
  ]);

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "BookIssue",
    entityId: issue.id,
    module: "library",
    description: `Issued book "${book.title}" to ${data.borrowerType.toLowerCase()} ${data.borrowerId}`,
    newData: issue,
  });

  return { data: issue };
}

export async function returnBookAction(issueId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.LIBRARY_RETURN);
  if (denied) return denied;

  const issue = await db.bookIssue.findUnique({
    where: { id: issueId },
    include: { book: true },
  });

  if (!issue) {
    return { error: "Issue record not found." };
  }

  if (issue.status === "RETURNED") {
    return { error: "This book has already been returned." };
  }

  // Calculate fine if overdue: days overdue * 2
  const now = new Date();
  let fineAmount: number | null = null;
  if (now > issue.dueDate) {
    const diffMs = now.getTime() - issue.dueDate.getTime();
    const daysOverdue = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    fineAmount = daysOverdue * 2;
  }

  const newAvailable = issue.book.availableCopies + 1;
  let newStatus: "AVAILABLE" | "LOW_STOCK" | "OUT_OF_STOCK" = "AVAILABLE";
  if (newAvailable <= Math.ceil(issue.book.totalCopies * 0.2) && newAvailable < issue.book.totalCopies) {
    newStatus = "LOW_STOCK";
  }

  const [updatedIssue] = await Promise.all([
    db.bookIssue.update({
      where: { id: issueId },
      data: {
        returnedAt: now,
        returnedTo: ctx.session.user.id,
        status: "RETURNED",
        fineAmount,
      },
    }),
    db.book.update({
      where: { id: issue.bookId },
      data: {
        availableCopies: newAvailable,
        status: newStatus,
      },
    }),
  ]);

  await audit({
    userId: ctx.session.user.id,
    action: "UPDATE",
    entity: "BookIssue",
    entityId: issueId,
    module: "library",
    description: `Returned book "${issue.book.title}"${fineAmount ? ` with fine of ${fineAmount}` : ""}`,
    previousData: issue,
    newData: updatedIssue,
  });

  return { data: updatedIssue };
}

export async function getOverdueAction() {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.LIBRARY_READ);
  if (denied) return denied;

  const now = new Date();

  const overdueIssues = await db.bookIssue.findMany({
    where: {
      book: { schoolId: ctx.schoolId },
      status: "ISSUED",
      dueDate: { lt: now },
    },
    include: {
      book: { select: { id: true, title: true, author: true } },
    },
    orderBy: { dueDate: "asc" },
  });

  // Fetch borrower names
  const borrowerIds = [...new Set(overdueIssues.map((i) => i.borrowerId))];
  let borrowerMap = new Map<string, string>();
  if (borrowerIds.length > 0) {
    const students = await db.student.findMany({
      where: { id: { in: borrowerIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    students.forEach((s) => borrowerMap.set(s.id, `${s.firstName} ${s.lastName}`));

    const users = await db.user.findMany({
      where: { id: { in: borrowerIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    users.forEach((u) => borrowerMap.set(u.id, `${u.firstName} ${u.lastName}`));
  }

  const data = overdueIssues.map((issue) => {
    const diffMs = now.getTime() - issue.dueDate.getTime();
    const daysOverdue = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    return {
      id: issue.id,
      bookId: issue.book.id,
      bookTitle: issue.book.title,
      bookAuthor: issue.book.author,
      borrowerId: issue.borrowerId,
      borrowerName: borrowerMap.get(issue.borrowerId) ?? "Unknown",
      borrowerType: issue.borrowerType,
      issuedAt: issue.issuedAt,
      dueDate: issue.dueDate,
      daysOverdue,
      estimatedFine: daysOverdue * 2,
    };
  });

  return { data };
}

// ─── Digital Resources ─────────────────────────────────────────────

export async function getDigitalResourcesAction(filters?: {
  search?: string;
  category?: string;
  type?: string;
  page?: number;
  pageSize?: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.LIBRARY_READ);
  if (denied) return denied;

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 25;
  const skip = (page - 1) * pageSize;

  const where: Prisma.DigitalResourceWhereInput = {
    schoolId: ctx.schoolId,
    ...(filters?.category && { category: filters.category }),
    ...(filters?.type && { type: filters.type as any }),
    ...(filters?.search && {
      OR: [
        { title: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
      ],
    }),
  };

  const [resources, total] = await Promise.all([
    db.digitalResource.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    db.digitalResource.count({ where }),
  ]);

  // Fetch uploader names
  const uploaderIds = [...new Set(resources.map((r) => r.uploadedBy))];
  let uploaderMap = new Map<string, string>();
  if (uploaderIds.length > 0) {
    const users = await db.user.findMany({
      where: { id: { in: uploaderIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    uploaderMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
  }

  const data = resources.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    type: r.type,
    fileUrl: r.fileUrl,
    category: r.category,
    uploadedBy: r.uploadedBy,
    uploadedByName: uploaderMap.get(r.uploadedBy) ?? "Unknown",
    accessLevel: r.accessLevel,
    createdAt: r.createdAt,
  }));

  return { data, total, page, pageSize };
}

export async function createDigitalResourceAction(data: {
  title: string;
  description?: string;
  type?: "DOCUMENT" | "VIDEO" | "AUDIO" | "EBOOK" | "LINK";
  fileUrl: string;
  category?: string;
  accessLevel?: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.LIBRARY_CREATE);
  if (denied) return denied;

  const resource = await db.digitalResource.create({
    data: {
      schoolId: ctx.schoolId,
      title: data.title,
      description: data.description || null,
      type: data.type ?? "DOCUMENT",
      fileUrl: data.fileUrl,
      category: data.category || null,
      uploadedBy: ctx.session.user.id,
      accessLevel: data.accessLevel ?? "ALL",
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "DigitalResource",
    entityId: resource.id,
    module: "library",
    description: `Created digital resource "${resource.title}"`,
    newData: resource,
  });

  return { data: resource };
}

export async function deleteDigitalResourceAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.LIBRARY_DELETE);
  if (denied) return denied;

  const resource = await db.digitalResource.findUnique({ where: { id } });
  if (!resource) {
    return { error: "Digital resource not found." };
  }

  await db.digitalResource.delete({ where: { id } });

  await audit({
    userId: ctx.session.user.id,
    action: "DELETE",
    entity: "DigitalResource",
    entityId: id,
    module: "library",
    description: `Deleted digital resource "${resource.title}"`,
    previousData: resource,
  });

  return { success: true };
}

// ─── Library Stats ─────────────────────────────────────────────────

export async function getLibraryStatsAction() {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.LIBRARY_READ);
  if (denied) return denied;

  const now = new Date();

  const [totalBooks, availableBooks, issuedCount, overdueCount, digitalResourcesCount] =
    await Promise.all([
      db.book.count({ where: { schoolId: ctx.schoolId } }),
      db.book.count({ where: { schoolId: ctx.schoolId, status: "AVAILABLE" } }),
      db.bookIssue.count({
        where: { book: { schoolId: ctx.schoolId }, status: "ISSUED" },
      }),
      db.bookIssue.count({
        where: {
          book: { schoolId: ctx.schoolId },
          status: "ISSUED",
          dueDate: { lt: now },
        },
      }),
      db.digitalResource.count({ where: { schoolId: ctx.schoolId } }),
    ]);

  return {
    data: {
      totalBooks,
      availableBooks,
      issuedCount,
      overdueCount,
      digitalResourcesCount,
    },
  };
}
