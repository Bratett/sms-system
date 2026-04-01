import { auth } from "@/lib/auth";
import { getBudgetsAction } from "@/modules/accounting/actions/budget.action";
import { getExpenseCategoriesAction } from "@/modules/accounting/actions/expense.action";
import { getAcademicYearsAction } from "@/modules/school/actions/academic-year.action";
import { getTermsAction } from "@/modules/school/actions/term.action";
import { BudgetsClient } from "./budgets-client";

export default async function BudgetsPage() {
  const session = await auth();
  if (!session?.user) return null;

  const [budgetsResult, categoriesResult, academicYearsResult, termsResult] = await Promise.all([
    getBudgetsAction(),
    getExpenseCategoriesAction(),
    getAcademicYearsAction(),
    getTermsAction(),
  ]);

  return (
    <BudgetsClient
      budgets={budgetsResult.data ?? []}
      expenseCategories={categoriesResult.data ?? []}
      academicYears={academicYearsResult.data ?? []}
      terms={termsResult.data ?? []}
    />
  );
}
