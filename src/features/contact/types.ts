export type ContactSubmission = {
  name: string;
  mobile: string;
  description: string;
};
export type ContactReceipt = { id: string; created_at: string };
export const contactNameMaxLength = 120;
export const contactDescriptionMaxLength = 5000;
