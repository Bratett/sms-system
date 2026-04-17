import { auth } from "@/lib/auth";
import {
  listSupplierInvoicesAction,
  getMatchToleranceAction,
} from "@/modules/inventory/actions/supplier-invoice.action";
import { SupplierInvoicesClient } from "./supplier-invoices-client";

export default async function SupplierInvoicesPage() {
  const session = await auth();
  if (!session?.user) return null;

  const [invoices, tolerance] = await Promise.all([
    listSupplierInvoicesAction(),
    getMatchToleranceAction(),
  ]);

  return (
    <SupplierInvoicesClient
      initialInvoices={("data" in invoices ? invoices.data.invoices : []) as never}
      tolerance={("data" in tolerance ? tolerance.data : null) as never}
    />
  );
}
