"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

interface ModuleMenuContextValue {
  open: boolean;
  setOpen: (v: boolean) => void;
  toggle: () => void;
}

const ModuleMenuContext = createContext<ModuleMenuContextValue | null>(null);

export function ModuleMenuProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((v) => !v), []);
  const value = useMemo<ModuleMenuContextValue>(() => ({ open, setOpen, toggle }), [open, toggle]);
  return <ModuleMenuContext.Provider value={value}>{children}</ModuleMenuContext.Provider>;
}

export function useModuleMenu(): ModuleMenuContextValue {
  const ctx = useContext(ModuleMenuContext);
  if (!ctx) throw new Error("useModuleMenu must be used inside <ModuleMenuProvider>");
  return ctx;
}
