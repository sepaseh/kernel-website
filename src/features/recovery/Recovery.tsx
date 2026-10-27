"use client";
import { OtpForm } from "@/features/auth/OtpForm";

import { requestRecoveryCode, resetPassword } from "./api";

export function Recovery() {
  return (
    <OtpForm
      kind="recovery"
      complete={resetPassword}
      requestCode={requestRecoveryCode}
    />
  );
}
