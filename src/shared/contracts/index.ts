// The HTTP wire contract is snake_case; consumers own any view-model conversion.
type PermissionKey =
  | "calendar.read"
  | "calendar.update"
  | "roles.create"
  | "roles.delete"
  | "roles.read"
  | "roles.update"
  | "settings.update"
  | "users.create"
  | "users.delete"
  | "users.read"
  | "users.update";
// Trimmed JavaScript string length (UTF-16 code units), shared by HTTP and forms.
export const profileNameMaxLength = 1_000;
export type Account = {
  id: string;
  first_name: string;
  last_name: string;
  mobile: string;
  email?: string;
  username?: string;
  is_system_admin: boolean;
  permissions: PermissionKey[];
  status: "active" | "inactive";
};
export type OtpResponse = { expires_in: number; remaining_seconds: number };
export const AuthPaths = {
  login: "/auth/login",
  register: "/auth/register",
  otpRequest: "/auth/otp-request",
  logout: "/auth/logout",
  forgotPassword: "/auth/forgot-password",
} as const;
