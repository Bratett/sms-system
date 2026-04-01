import { db } from "@/lib/db";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

function formatCurrency(amount: number): string {
  return `GHS ${amount.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function ReceiptVerificationPage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number: receiptNumber } = await params;

  const receipt = await db.receipt.findFirst({
    where: { receiptNumber: decodeURIComponent(receiptNumber) },
    include: {
      payment: {
        include: {
          studentBill: {
            include: {
              feeStructure: {
                select: { name: true, schoolId: true },
              },
              billItems: {
                include: { feeItem: { select: { name: true, code: true } } },
              },
            },
          },
        },
      },
    },
  });

  if (!receipt) {
    notFound();
  }

  const payment = receipt.payment;
  const bill = payment.studentBill;

  // Fetch student and school info
  const [student, school] = await Promise.all([
    db.student.findUnique({
      where: { id: payment.studentId },
      select: { studentId: true, firstName: true, lastName: true },
    }),
    db.school.findFirst({
      where: { id: bill.feeStructure.schoolId },
      select: { name: true, logoUrl: true },
    }),
  ]);

  const isValid = payment.status === "CONFIRMED";

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="mx-auto max-w-lg">
        {/* Verification Status */}
        <div className={`rounded-t-lg px-6 py-4 text-center ${isValid ? "bg-green-600" : "bg-red-600"}`}>
          <div className="text-3xl mb-1">{isValid ? "\u2713" : "\u2717"}</div>
          <h1 className="text-xl font-bold text-white">
            {isValid ? "Valid Receipt" : "Invalid Receipt"}
          </h1>
          <p className="text-sm text-white/80">
            {isValid ? "This receipt has been verified as authentic." : "This receipt could not be verified. It may have been reversed."}
          </p>
        </div>

        {/* Receipt Details */}
        <div className="rounded-b-lg border border-t-0 border-gray-200 bg-white p-6 shadow-sm">
          <div className="space-y-4">
            <div className="text-center border-b border-gray-100 pb-4">
              <h2 className="text-lg font-bold">{school?.name ?? "School"}</h2>
              <p className="text-sm text-gray-500">Official Payment Receipt</p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">Receipt No:</span>
                <p className="font-medium">{receipt.receiptNumber}</p>
              </div>
              <div>
                <span className="text-gray-500">Date:</span>
                <p className="font-medium">{new Date(payment.receivedAt).toLocaleDateString("en-GH", { year: "numeric", month: "long", day: "numeric" })}</p>
              </div>
              <div>
                <span className="text-gray-500">Student:</span>
                <p className="font-medium">{student ? `${student.firstName} ${student.lastName}` : "Unknown"}</p>
              </div>
              <div>
                <span className="text-gray-500">Student ID:</span>
                <p className="font-medium">{student?.studentId ?? "N/A"}</p>
              </div>
              <div>
                <span className="text-gray-500">Fee Structure:</span>
                <p className="font-medium">{bill.feeStructure.name}</p>
              </div>
              <div>
                <span className="text-gray-500">Method:</span>
                <p className="font-medium">{payment.paymentMethod.replace("_", " ")}</p>
              </div>
            </div>

            {/* Fee Items */}
            <div className="border-t border-gray-100 pt-4">
              <h3 className="text-sm font-medium mb-2">Fee Breakdown</h3>
              <div className="space-y-1">
                {bill.billItems.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-gray-600">{item.feeItem.name}</span>
                    <span>{formatCurrency(item.amount)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment Summary */}
            <div className="border-t border-gray-100 pt-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Bill Total:</span>
                <span>{formatCurrency(bill.totalAmount)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold mt-2">
                <span>Amount Paid:</span>
                <span className="text-green-600">{formatCurrency(payment.amount)}</span>
              </div>
              {payment.referenceNumber && (
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-gray-500">Reference:</span>
                  <span>{payment.referenceNumber}</span>
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 pt-4 text-center text-xs text-gray-400">
              <p>This is a computer-generated verification.</p>
              <p>Verified at {new Date().toISOString()}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
