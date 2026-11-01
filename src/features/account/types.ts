export type { Account } from "@/shared/contracts";

export type EmailVerificationRequest = { email: string };

export type EmailVerifyRequest = EmailVerificationRequest & { otp: string };

export type PasswordChangeRequest = {
  current_password: string;
  new_password: string;
};

export type ProfileUpdateRequest = { first_name?: string; last_name?: string };

export type UsernameUpdateRequest = { username: string };
