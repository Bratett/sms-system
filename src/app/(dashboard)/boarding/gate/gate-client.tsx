"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  scanExeatAction,
  gateDepartAction,
  gateReturnAction,
} from "@/modules/boarding/actions/exeat-gate.action";
import {
  requestGuardianOtpAction,
  verifyGuardianOtpAction,
} from "@/modules/boarding/actions/exeat-otp.action";

interface ScannedExeat {
  id: string;
  exeatNumber: string;
  status: string;
  type: string;
  expectedReturnDate: Date | string | null;
  actualReturnDate: Date | string | null;
  guardianPhone: string | null;
  student: {
    id: string;
    studentId: string;
    fullName: string;
    photoUrl: string | null;
  } | null;
  hasVerifiedOtp: boolean;
  canDepart: boolean;
  canReturn: boolean;
}

type GeoPoint = { lat: number; lng: number } | null;

export function GateClient() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [exeatNumber, setExeatNumber] = useState("");
  const [scanned, setScanned] = useState<ScannedExeat | null>(null);
  const [otpSentTo, setOtpSentTo] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");

  function requestGeo(): Promise<GeoPoint> {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(null), 3000);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(timeout);
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          clearTimeout(timeout);
          resolve(null);
        },
        { timeout: 3000, enableHighAccuracy: false },
      );
    });
  }

  function handleScan(e: React.FormEvent) {
    e.preventDefault();
    if (!exeatNumber.trim()) return;
    startTransition(async () => {
      const r = await scanExeatAction({ exeatNumber });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      setScanned(r.data as ScannedExeat);
      setOtpSentTo(null);
      setOtpCode("");
    });
  }

  function handleRequestOtp() {
    if (!scanned) return;
    startTransition(async () => {
      const r = await requestGuardianOtpAction({ exeatId: scanned.id });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      setOtpSentTo(r.data.sentTo);
      toast.success(`OTP sent to ${r.data.sentTo}`);
    });
  }

  function handleVerifyOtp() {
    if (!scanned || otpCode.length !== 6) return;
    startTransition(async () => {
      const r = await verifyGuardianOtpAction({
        exeatId: scanned.id,
        code: otpCode,
      });
      if ("error" in r) {
        const extra =
          "attemptsRemaining" in r
            ? ` (${r.attemptsRemaining} attempts left)`
            : "";
        toast.error(`${r.error}${extra}`);
        return;
      }
      toast.success("OTP verified. Release allowed.");
      setScanned({ ...scanned, hasVerifiedOtp: true, canDepart: true });
    });
  }

  function handleDepart() {
    if (!scanned || !scanned.canDepart) return;
    startTransition(async () => {
      const geo = await requestGeo();
      const r = await gateDepartAction({
        exeatId: scanned.id,
        geoLat: geo?.lat,
        geoLng: geo?.lng,
      });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success("Departure recorded.");
      setScanned(null);
      setExeatNumber("");
      setOtpSentTo(null);
      setOtpCode("");
      router.refresh();
    });
  }

  function handleReturn() {
    if (!scanned || !scanned.canReturn) return;
    startTransition(async () => {
      const geo = await requestGeo();
      const r = await gateReturnAction({
        exeatId: scanned.id,
        geoLat: geo?.lat,
        geoLng: geo?.lng,
      });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success("Return recorded.");
      setScanned(null);
      setExeatNumber("");
      setOtpSentTo(null);
      setOtpCode("");
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-lg p-4 pb-24">
      <h1 className="mb-4 text-2xl font-semibold">Gate Check</h1>

      <form onSubmit={handleScan} className="space-y-3">
        <label className="block">
          <span className="text-sm font-medium text-gray-700">
            Exeat number (scan or type)
          </span>
          <input
            type="text"
            value={exeatNumber}
            onChange={(e) => setExeatNumber(e.target.value.toUpperCase())}
            placeholder="EXT/2026/0001"
            autoFocus
            inputMode="text"
            autoCapitalize="characters"
            className="mt-1 block w-full rounded border border-gray-300 p-4 text-xl font-mono tracking-wider focus:border-blue-500 focus:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={pending || !exeatNumber.trim()}
          className="w-full rounded bg-blue-600 p-4 text-lg font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Looking up…" : "Find exeat"}
        </button>
      </form>

      {scanned && (
        <div className="mt-6 space-y-4 rounded border border-gray-200 bg-white p-4 shadow">
          <div>
            <div className="text-sm text-gray-500">Exeat</div>
            <div className="font-mono text-lg">{scanned.exeatNumber}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Student</div>
            <div className="text-xl font-semibold">
              {scanned.student?.fullName ?? "Unknown"}{" "}
              <span className="ml-2 font-mono text-sm text-gray-500">
                {scanned.student?.studentId}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill status={scanned.status} />
            <span className="text-sm text-gray-500">
              Type: {scanned.type}
            </span>
          </div>

          {scanned.status === "HEADMASTER_APPROVED" && !scanned.hasVerifiedOtp && (
            <div className="rounded border border-amber-300 bg-amber-50 p-3">
              <div className="mb-2 text-sm font-medium text-amber-900">
                Guardian OTP required
              </div>
              {!otpSentTo ? (
                <button
                  type="button"
                  onClick={handleRequestOtp}
                  disabled={pending || !scanned.guardianPhone}
                  className="w-full rounded bg-amber-600 p-3 text-white disabled:opacity-50"
                >
                  {scanned.guardianPhone
                    ? "Send code to guardian"
                    : "No guardian phone on file"}
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="text-xs text-gray-600">
                    Code sent to <strong>{otpSentTo}</strong>. Ask the guardian
                    to read it out.
                  </div>
                  <input
                    type="text"
                    value={otpCode}
                    onChange={(e) =>
                      setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    placeholder="6-digit code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    className="w-full rounded border border-gray-300 p-3 text-center font-mono text-2xl tracking-[0.5em]"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyOtp}
                    disabled={pending || otpCode.length !== 6}
                    className="w-full rounded bg-amber-600 p-3 text-white disabled:opacity-50"
                  >
                    {pending ? "Verifying…" : "Verify code"}
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleDepart}
              disabled={pending || !scanned.canDepart}
              className="rounded bg-green-600 p-4 text-lg font-semibold text-white disabled:opacity-40"
            >
              Depart
            </button>
            <button
              type="button"
              onClick={handleReturn}
              disabled={pending || !scanned.canReturn}
              className="rounded bg-indigo-600 p-4 text-lg font-semibold text-white disabled:opacity-40"
            >
              Return
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setScanned(null);
              setExeatNumber("");
              setOtpSentTo(null);
              setOtpCode("");
            }}
            className="w-full text-sm text-gray-500 underline"
          >
            Scan next student
          </button>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const colours: Record<string, string> = {
    REQUESTED: "bg-gray-100 text-gray-700",
    HOUSEMASTER_APPROVED: "bg-blue-100 text-blue-700",
    HEADMASTER_APPROVED: "bg-purple-100 text-purple-700",
    DEPARTED: "bg-green-100 text-green-700",
    RETURNED: "bg-gray-100 text-gray-700",
    OVERDUE: "bg-red-100 text-red-700",
    REJECTED: "bg-red-100 text-red-700",
    CANCELLED: "bg-gray-100 text-gray-500",
  };
  const cls = colours[status] ?? "bg-gray-100 text-gray-700";
  return (
    <span className={`rounded-full px-2 py-1 text-xs font-medium ${cls}`}>
      {status.replace("_", " ")}
    </span>
  );
}
