import { normalizeDigits } from "@/shared/lib/form-values";

import {
  contactDescriptionMaxLength,
  contactNameMaxLength,
  type ContactSubmission,
} from "./types";

export function normalizedContact(value: ContactSubmission): ContactSubmission {
  const mobile = normalizeDigits(value.mobile.trim());
  return {
    name: value.name.trim(),
    mobile: mobile.startsWith("09") ? `+98${mobile.slice(1)}` : mobile,
    description: value.description.trim(),
  };
}

export function invalidContactFields(value: ContactSubmission) {
  return {
    name: !value.name || value.name.length > contactNameMaxLength,
    mobile: !/^\+989\d{9}$/.test(value.mobile),
    description:
      !value.description ||
      value.description.length > contactDescriptionMaxLength,
  };
}
