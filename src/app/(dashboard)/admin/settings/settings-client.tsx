"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  updateSystemSettingAction,
  deleteSystemSettingAction,
} from "@/modules/school/actions/settings.action";
import { Pencil, Trash2, Plus, Save, X } from "lucide-react";

interface SystemSetting {
  id: string;
  key: string;
  value: string;
  type: string;
  module: string | null;
  description: string | null;
}

export function SettingsClient({ initialSettings }: { initialSettings: SystemSetting[] }) {
  const router = useRouter();
  const [settings, setSettings] = useState(initialSettings);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  async function handleSave(key: string, value: string) {
    const result = await updateSystemSettingAction(key, value);
    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success(`Setting "${key}" saved`);
      setEditingKey(null);
      router.refresh();
    }
  }

  async function handleDelete(key: string) {
    if (!confirm(`Delete setting "${key}"?`)) return;
    const result = await deleteSystemSettingAction(key);
    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success(`Setting "${key}" deleted`);
      setSettings(settings.filter((s) => s.key !== key));
      router.refresh();
    }
  }

  async function handleAdd() {
    if (!newKey.trim()) {
      toast.error("Key is required");
      return;
    }
    const result = await updateSystemSettingAction(newKey.trim(), newValue);
    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success(`Setting "${newKey}" created`);
      setShowAdd(false);
      setNewKey("");
      setNewValue("");
      router.refresh();
    }
  }

  // Group settings by module
  const grouped: Record<string, SystemSetting[]> = {};
  for (const s of settings) {
    const mod = s.module || "general";
    if (!grouped[mod]) grouped[mod] = [];
    grouped[mod].push(s);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Add Setting
        </button>
      </div>

      {showAdd && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h4 className="text-sm font-medium">New Setting</h4>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <input
              placeholder="Key (e.g., attendance.late_threshold_minutes)"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              className="rounded-md border border-input px-3 py-2 text-sm"
            />
            <input
              placeholder="Value"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              className="rounded-md border border-input px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                className="flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
              >
                <Save className="h-4 w-4" /> Save
              </button>
              <button
                onClick={() => setShowAdd(false)}
                className="flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm"
              >
                <X className="h-4 w-4" /> Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {Object.keys(grouped).length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-12 text-center">
          <p className="text-muted-foreground">No system settings configured yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add settings to configure system behavior
          </p>
        </div>
      ) : (
        Object.entries(grouped).map(([module, moduleSettings]) => (
          <div key={module} className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold capitalize">{module}</h3>
            </div>
            <div className="divide-y divide-border">
              {moduleSettings.map((setting) => (
                <div key={setting.key} className="flex items-center gap-4 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium font-mono">{setting.key}</p>
                    {setting.description && (
                      <p className="text-xs text-muted-foreground">{setting.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {editingKey === setting.key ? (
                      <>
                        <input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="w-48 rounded-md border border-input px-2 py-1 text-sm"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSave(setting.key, editValue)}
                          className="rounded p-1 text-primary hover:bg-accent"
                        >
                          <Save className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setEditingKey(null)}
                          className="rounded p-1 hover:bg-accent"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="rounded bg-muted px-2 py-1 text-sm font-mono">
                          {setting.value}
                        </span>
                        <button
                          onClick={() => {
                            setEditingKey(setting.key);
                            setEditValue(setting.value);
                          }}
                          className="rounded p-1 hover:bg-accent"
                        >
                          <Pencil className="h-4 w-4 text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => handleDelete(setting.key)}
                          className="rounded p-1 hover:bg-accent"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
