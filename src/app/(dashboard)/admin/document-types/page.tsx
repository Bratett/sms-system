import { PageHeader } from "@/components/layout/page-header";
import { listDocumentTypesAction } from "@/modules/student/actions/document.action";
import { DocumentTypesClient } from "./document-types-client";

export default async function DocumentTypesPage() {
  const res = await listDocumentTypesAction();
  const types = "data" in res ? res.data : [];
  const error = "error" in res ? res.error : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Document Types"
        description="Manage the catalog of student document categories used across your school's student vault."
      />
      <DocumentTypesClient types={types} error={error} />
    </div>
  );
}
