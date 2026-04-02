"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { toNum } from "@/lib/decimal";

// ─── Rate Supplier ──────────────────────────────────────────────────

export async function rateSupplierAction(data: {
  supplierId: string;
  purchaseOrderId?: string;
  deliveryScore: number;
  qualityScore: number;
  pricingScore: number;
  comments?: string;
}) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  // Validate scores
  for (const [field, score] of [
    ["deliveryScore", data.deliveryScore],
    ["qualityScore", data.qualityScore],
    ["pricingScore", data.pricingScore],
  ] as const) {
    if (score < 1 || score > 5) {
      return { error: `${field} must be between 1 and 5.` };
    }
  }

  const supplier = await db.supplier.findUnique({ where: { id: data.supplierId } });
  if (!supplier) return { error: "Supplier not found." };

  const overallScore = Math.round(((data.deliveryScore + data.qualityScore + data.pricingScore) / 3) * 10) / 10;

  const rating = await db.supplierRating.create({
    data: {
      supplierId: data.supplierId,
      purchaseOrderId: data.purchaseOrderId || null,
      deliveryScore: data.deliveryScore,
      qualityScore: data.qualityScore,
      pricingScore: data.pricingScore,
      overallScore,
      comments: data.comments || null,
      ratedBy: session.user.id!,
    },
  });

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "SupplierRating",
    entityId: rating.id,
    module: "inventory",
    description: `Rated supplier "${supplier.name}" — overall: ${overallScore}/5`,
    newData: rating,
  });

  return { data: rating };
}

// ─── Get Supplier Ratings ───────────────────────────────────────────

export async function getSupplierRatingsAction(supplierId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const ratings = await db.supplierRating.findMany({
    where: { supplierId },
    orderBy: { ratedAt: "desc" },
  });

  // Fetch rater names
  const raterIds = [...new Set(ratings.map((r) => r.ratedBy))];
  const users = raterIds.length > 0
    ? await db.user.findMany({ where: { id: { in: raterIds } }, select: { id: true, firstName: true, lastName: true } })
    : [];
  const userMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));

  const data = ratings.map((r) => ({
    id: r.id,
    deliveryScore: r.deliveryScore,
    qualityScore: r.qualityScore,
    pricingScore: r.pricingScore,
    overallScore: toNum(r.overallScore),
    comments: r.comments,
    ratedBy: r.ratedBy,
    ratedByName: userMap.get(r.ratedBy) ?? "Unknown",
    ratedAt: r.ratedAt,
    purchaseOrderId: r.purchaseOrderId,
  }));

  // Calculate averages
  const avgDelivery = data.length > 0 ? Math.round((data.reduce((s, r) => s + r.deliveryScore, 0) / data.length) * 10) / 10 : 0;
  const avgQuality = data.length > 0 ? Math.round((data.reduce((s, r) => s + r.qualityScore, 0) / data.length) * 10) / 10 : 0;
  const avgPricing = data.length > 0 ? Math.round((data.reduce((s, r) => s + r.pricingScore, 0) / data.length) * 10) / 10 : 0;
  const avgOverall = data.length > 0 ? Math.round((data.reduce((s, r) => s + r.overallScore, 0) / data.length) * 10) / 10 : 0;

  return {
    data,
    averages: {
      delivery: avgDelivery,
      quality: avgQuality,
      pricing: avgPricing,
      overall: avgOverall,
      totalRatings: data.length,
    },
  };
}

// ─── Supplier Scorecards ────────────────────────────────────────────

export async function getSupplierScorecardsAction() {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  const suppliers = await db.supplier.findMany({
    where: { schoolId: school.id, status: "ACTIVE" },
    include: {
      ratings: true,
      purchaseOrders: {
        where: { status: { not: "CANCELLED" } },
        select: { totalAmount: true },
      },
    },
  });

  const data = suppliers.map((supplier) => {
    const ratings = supplier.ratings;
    const totalSpend = supplier.purchaseOrders.reduce((s, po) => s + toNum(po.totalAmount), 0);

    const avgDelivery = ratings.length > 0 ? ratings.reduce((s, r) => s + r.deliveryScore, 0) / ratings.length : null;
    const avgQuality = ratings.length > 0 ? ratings.reduce((s, r) => s + r.qualityScore, 0) / ratings.length : null;
    const avgPricing = ratings.length > 0 ? ratings.reduce((s, r) => s + r.pricingScore, 0) / ratings.length : null;
    const avgOverall = ratings.length > 0 ? ratings.reduce((s, r) => s + toNum(r.overallScore), 0) / ratings.length : null;

    return {
      id: supplier.id,
      name: supplier.name,
      contactPerson: supplier.contactPerson,
      totalOrders: supplier.purchaseOrders.length,
      totalSpend,
      ratingCount: ratings.length,
      avgDelivery: avgDelivery ? Math.round(avgDelivery * 10) / 10 : null,
      avgQuality: avgQuality ? Math.round(avgQuality * 10) / 10 : null,
      avgPricing: avgPricing ? Math.round(avgPricing * 10) / 10 : null,
      avgOverall: avgOverall ? Math.round(avgOverall * 10) / 10 : null,
    };
  });

  return { data: data.sort((a, b) => (b.avgOverall ?? 0) - (a.avgOverall ?? 0)) };
}
