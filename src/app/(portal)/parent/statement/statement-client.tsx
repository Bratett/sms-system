"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { initiatePortalPaymentAction } from "@/modules/portal/actions/portal-payment.action";

interface Child { id: string; studentId: string; name: string }
interface Payment { id: string; amount: number; method: string; reference: string | null; receivedAt: Date | string; receiptNumber: string | null }
interface Installment { id: string; installmentNumber: number; amount: number; paidAmount: number; dueDate: Date | string; status: string }
interface Penalty { id: string; amount: number; appliedAt: Date | string }
interface Bill {
  id: string;
  feeStructure: string;
  total: number;
  paid: number;
  balance: number;
  status: string;
  dueDate: Date | string | null;
  generatedAt: Date | string;
  payments: Payment[];
  installments: Installment[];
  penalties: Penalty[];
}
interface Statement {
  student: { id: string; studentId: string; name: string };
  summary: { totalBilled: number; totalPaid: number; totalBalance: number };
  bills: Bill[];
}

function money(n: number): string {
  return `GHS ${n.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function StatementClient({
  children,
  selectedId,
  statement,
}: {
  children: Child[];
  selectedId?: string;
  statement: Statement | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [payBill, setPayBill] = useState<Bill | null>(null);
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState<string>("");
  const t = useTranslations("portal");
  const tc = useTranslations("common");

  const onStudentChange = (id: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set("studentId", id);
    router.replace(`?${params.toString()}`);
  };

  const onPay = () => {
    if (!payBill) return;
    const n = parseFloat(amount);
    if (!email.includes("@")) return toast.error("Enter a valid email");
    if (!n || n <= 0) return toast.error("Enter an amount");
    start(async () => {
      const res = await initiatePortalPaymentAction({
        studentBillId: payBill.id,
        amount: n,
        email,
      });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      if (res.data.authorizationUrl) {
        window.location.href = res.data.authorizationUrl;
      } else {
        toast.success(t("paymentSuccess"));
      }
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("statementTitle")} description={t("statementDesc")} />

      {children.length > 1 && (
        <select
          value={selectedId ?? ""}
          onChange={(e) => onStudentChange(e.target.value)}
          className="rounded border p-2 text-sm"
        >
          {children.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.studentId})
            </option>
          ))}
        </select>
      )}

      {!statement ? (
        <EmptyState title={t("noStatement")} description={t("noStatementDesc")} />
      ) : (
        <>
          <section className="grid gap-3 md:grid-cols-3">
            <Tile label={t("totalBilled")} value={money(statement.summary.totalBilled)} />
            <Tile label={t("totalPaid")} value={money(statement.summary.totalPaid)} />
            <Tile
              label={t("outstanding")}
              value={money(statement.summary.totalBalance)}
              emphasis={statement.summary.totalBalance > 0}
            />
          </section>

          <section className="space-y-4">
            {statement.bills.map((b) => (
              <article key={b.id} className="rounded border bg-card p-4 shadow-sm">
                <header className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{b.feeStructure}</h3>
                    <p className="text-xs text-muted-foreground">
                      {t("issued")} {new Date(b.generatedAt).toLocaleDateString("en-GH")} ·
                      {b.dueDate
                        ? ` ${t("due")} ${new Date(b.dueDate).toLocaleDateString("en-GH")}`
                        : ` ${t("noDueDate")}`}
                    </p>
                  </div>
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${
                      b.status === "PAID"
                        ? "bg-green-100 text-green-700"
                        : b.status === "PARTIAL"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-red-100 text-red-700"
                    }`}
                  >
                    {b.status}
                  </span>
                </header>

                <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">{t("total")}</dt>
                    <dd>{money(b.total)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">{t("paid")}</dt>
                    <dd>{money(b.paid)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">{t("balance")}</dt>
                    <dd className="font-semibold">{money(b.balance)}</dd>
                  </div>
                </dl>

                {b.installments.length > 0 && (
                  <div className="mt-3">
                    <p className="mb-1 text-xs font-semibold text-muted-foreground">
                      {t("installmentsHeading")}
                    </p>
                    <ul className="space-y-1 text-xs">
                      {b.installments.map((i) => (
                        <li key={i.id} className="flex justify-between">
                          <span>
                            {t("installmentLine", {
                              number: i.installmentNumber,
                              date: new Date(i.dueDate).toLocaleDateString("en-GH"),
                            })}
                          </span>
                          <span>
                            {money(i.paidAmount)} / {money(i.amount)} —{" "}
                            <span className="uppercase">{i.status}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {b.penalties.length > 0 && (
                  <div className="mt-3">
                    <p className="mb-1 text-xs font-semibold text-muted-foreground">
                      {t("penaltiesHeading")}
                    </p>
                    <ul className="space-y-1 text-xs">
                      {b.penalties.map((p) => (
                        <li key={p.id} className="flex justify-between">
                          <span>{new Date(p.appliedAt).toLocaleDateString("en-GH")}</span>
                          <span>{money(p.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {b.balance > 0 && (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => {
                        setPayBill(b);
                        setAmount(b.balance.toFixed(2));
                      }}
                      className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground"
                    >
                      {t("payNow")}
                    </button>
                  </div>
                )}
              </article>
            ))}
          </section>
        </>
      )}

      {payBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded bg-background p-6 shadow-xl">
            <h3 className="text-lg font-semibold">{t("payFeesTitle")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("outstandingModal", {
                feeStructure: payBill.feeStructure,
                amount: money(payBill.balance),
              })}
            </p>
            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                {t("email")}
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded border p-2 text-sm"
                  placeholder="parent@example.com"
                />
              </label>
              <label className="block text-sm">
                {t("amountGhs")}
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={payBill.balance}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="mt-1 w-full rounded border p-2 text-sm"
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPayBill(null)}
                className="rounded border px-3 py-1 text-sm"
              >
                {tc("cancel")}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={onPay}
                className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground disabled:opacity-50"
              >
                {pending ? t("redirecting") : t("continueCheckout")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Tile({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div
      className={`rounded border p-4 shadow-sm ${
        emphasis ? "border-red-300 bg-red-50" : "bg-card"
      }`}
    >
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}
