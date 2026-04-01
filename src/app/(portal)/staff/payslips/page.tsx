import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getMyPayslipsAction } from "@/modules/hr/actions/self-service.action";

export default async function StaffPayslipsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const result = await getMyPayslipsAction();
  const payslips = ("data" in result && result.data) ? result.data : [];

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold">My Payslips</h2>

      {payslips.length === 0 ? (
        <div className="rounded-lg border bg-white p-12 text-center text-gray-400">
          No payslips available yet.
        </div>
      ) : (
        <div className="rounded-lg border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-4 py-3 text-left font-medium">Period</th>
                <th className="px-4 py-3 text-right font-medium">Basic Salary</th>
                <th className="px-4 py-3 text-right font-medium">Allowances</th>
                <th className="px-4 py-3 text-right font-medium">Deductions</th>
                <th className="px-4 py-3 text-right font-medium">Net Pay</th>
                <th className="px-4 py-3 text-center font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {payslips.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">
                    {new Date(p.year, p.month - 1).toLocaleString("default", { month: "long", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3 text-right">{Number(p.basicSalary).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-green-600">+{Number(p.totalAllowances).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-red-600">-{Number(p.totalDeductions).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-bold">{Number(p.netPay).toLocaleString()}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      p.status === "APPROVED" ? "bg-green-100 text-green-700" :
                      p.status === "PAID" ? "bg-blue-100 text-blue-700" :
                      "bg-gray-100 text-gray-700"
                    }`}>{p.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
