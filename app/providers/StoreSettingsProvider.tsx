"use client";

import React, { createContext, useContext, useEffect, useMemo } from "react";
import type { StoreSettings } from "@/app/actions/storeSettingsActions";

const StoreSettingsContext = createContext<StoreSettings>({
  siteName: "童趣島",
  primaryColor: "#F59E0B",
  socialFbUrl: "",
  socialIgUrl: "",
  socialLineUrl: "",
  contactEmail: "",
  contactPhone: "",
  contactAddress: "",
});

export function useStoreSettings() {
  return useContext(StoreSettingsContext);
}

/** 將 hex 變暗一點作為 hover 色 */
function darkenHex(hex: string, percent: number = 0.9): string {
  const n = hex.replace(/^#/, "");
  const r = Math.max(0, Math.min(255, Math.floor(parseInt(n.slice(0, 2), 16) * percent)));
  const g = Math.max(0, Math.min(255, Math.floor(parseInt(n.slice(2, 4), 16) * percent)));
  const b = Math.max(0, Math.min(255, Math.floor(parseInt(n.slice(4, 6), 16) * percent)));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export function StoreSettingsProvider({
  initial,
  children,
}: {
  initial: StoreSettings;
  children: React.ReactNode;
}) {
  const value = useMemo(
    () => initial,
    [
      initial.siteName,
      initial.primaryColor,
      initial.socialFbUrl,
      initial.socialIgUrl,
      initial.socialLineUrl,
      initial.contactEmail,
      initial.contactPhone,
      initial.contactAddress,
    ]
  );

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--color-primary", value.primaryColor);
    root.style.setProperty("--color-primary-hover", darkenHex(value.primaryColor, 0.85));
  }, [value.primaryColor]);

  return (
    <StoreSettingsContext.Provider value={value}>
      {children}
    </StoreSettingsContext.Provider>
  );
}
