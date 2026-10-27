"use client";
import { OtpForm } from "@/features/auth/OtpForm";

import { register, requestRegistrationCode } from "./api";

export function Register() {
  return (
    <OtpForm
      kind="register"
      complete={register}
      requestCode={requestRegistrationCode}
    />
  );
}
