import { getSystemSettingsAction } from "@/modules/school/actions/settings.action";
import { PageHeader } from "@/components/layout/page-header";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const result = await getSystemSettingsAction();
  const settings = result && "settings" in result && result.settings ? result.settings : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Settings"
        description="Configure system-wide settings and preferences"
      />
      <SettingsClient initialSettings={settings} />
    </div>
  );
}
