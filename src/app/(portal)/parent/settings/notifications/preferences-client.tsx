"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  setNotificationPreferenceAction,
  clearNotificationPreferenceAction,
} from "@/modules/portal/actions/notification-preferences.action";

type Channel = "IN_APP" | "SMS" | "EMAIL" | "WHATSAPP" | "PUSH";

interface PreferenceRow {
  eventKey: string;
  displayName: string;
  defaultChannels: Channel[];
  effectiveChannels: Channel[];
  hasOverride: boolean;
}

const ALL_CHANNELS: Channel[] = ["IN_APP", "EMAIL", "SMS", "WHATSAPP", "PUSH"];
const CHANNEL_LABELS: Record<Channel, string> = {
  IN_APP: "In-app",
  EMAIL: "Email",
  SMS: "SMS",
  WHATSAPP: "WhatsApp",
  PUSH: "Push",
};

export function NotificationPreferencesClient({
  preferences,
}: {
  preferences: PreferenceRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [local, setLocal] = useState<Record<string, Channel[]>>(() =>
    Object.fromEntries(
      preferences.map((p) => [p.eventKey, [...p.effectiveChannels]]),
    ),
  );

  function toggle(eventKey: string, channel: Channel) {
    setLocal((prev) => {
      const current = prev[eventKey] ?? [];
      const next = current.includes(channel)
        ? current.filter((c) => c !== channel)
        : [...current, channel];
      return { ...prev, [eventKey]: next };
    });
  }

  function save(eventKey: string) {
    const channels = local[eventKey] ?? [];
    startTransition(async () => {
      const result = await setNotificationPreferenceAction({ eventKey, channels });
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Preference saved.");
        router.refresh();
      }
    });
  }

  function reset(eventKey: string, defaults: Channel[]) {
    startTransition(async () => {
      const result = await clearNotificationPreferenceAction(eventKey);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        setLocal((prev) => ({ ...prev, [eventKey]: [...defaults] }));
        toast.success("Reset to default.");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-2xl font-semibold">Notification Preferences</h1>
      <p className="text-sm text-gray-600">
        Choose which channels each notification reaches you through. Toggling
        a channel off stops that event from being sent to you on that channel.
      </p>

      <div className="space-y-3">
        {preferences.map((p) => {
          const selected = local[p.eventKey] ?? p.effectiveChannels;
          const dirty =
            JSON.stringify([...selected].sort()) !==
            JSON.stringify([...p.effectiveChannels].sort());
          return (
            <div
              key={p.eventKey}
              className="rounded border border-gray-200 bg-white p-4"
            >
              <div className="mb-2 flex items-start justify-between">
                <div>
                  <div className="font-medium">{p.displayName}</div>
                  <div className="font-mono text-xs text-gray-500">{p.eventKey}</div>
                </div>
                {p.hasOverride && (
                  <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-800">
                    custom
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {ALL_CHANNELS.map((c) => {
                  const on = selected.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggle(p.eventKey, c)}
                      disabled={pending}
                      className={
                        on
                          ? "rounded-full bg-blue-600 px-3 py-1 text-sm text-white"
                          : "rounded-full border border-gray-300 px-3 py-1 text-sm text-gray-700"
                      }
                    >
                      {CHANNEL_LABELS[c]}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 flex items-center justify-end gap-2">
                {p.hasOverride && (
                  <button
                    onClick={() => reset(p.eventKey, p.defaultChannels)}
                    disabled={pending}
                    className="text-xs text-gray-600 underline"
                  >
                    Reset to default
                  </button>
                )}
                <button
                  onClick={() => save(p.eventKey)}
                  disabled={pending || !dirty}
                  className="rounded bg-blue-600 px-3 py-1 text-sm text-white disabled:opacity-40"
                >
                  Save
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
