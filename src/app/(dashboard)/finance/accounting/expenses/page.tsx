import { auth } from "@/lib/auth";
import {
  getExpensesAction,
  getExpenseCategoriesAction,
} from "@/modules/accounting/actions/expense.action";
import { ExpensesClient } from "./expenses-client";

export default async function ExpensesPage() {
  const session = await auth();
  if (!session?.user) return null;

  const [expensesResult, categoriesResult] = await Promise.all([
    getExpensesAction(),
    getExpenseCategoriesAction(),
  ]);

  return (
    <ExpensesClient
      expenses={"data" in expensesResult ? expensesResult.data : []}
      categories={"data" in categoriesResult ? categoriesResult.data : []}
      pagination={"pagination" in expensesResult ? expensesResult.pagination ?? { page: 1, pageSize: 25, total: 0, totalPages: 0 } : { page: 1, pageSize: 25, total: 0, totalPages: 0 }}
    />
  );
}
