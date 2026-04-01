import { auth } from "@/lib/auth";
import { getExpenseClaimsAction } from "@/modules/accounting/actions/expense-claim.action";
import { getExpenseCategoriesAction } from "@/modules/accounting/actions/expense.action";
import { ExpenseClaimsClient } from "./expense-claims-client";

export default async function ExpenseClaimsPage() {
  const session = await auth();
  if (!session?.user) return null;

  const [claimsResult, categoriesResult] = await Promise.all([
    getExpenseClaimsAction(),
    getExpenseCategoriesAction(),
  ]);

  return (
    <ExpenseClaimsClient
      claims={claimsResult.data ?? []}
      pagination={claimsResult.pagination ?? { page: 1, pageSize: 25, total: 0, totalPages: 0 }}
      expenseCategories={categoriesResult.data ?? []}
    />
  );
}
