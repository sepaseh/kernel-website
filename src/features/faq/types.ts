export type Faq = {
  id: string;
  question: string;
  answer: string;
  sort: number;
};

export type FaqList = { items: Faq[]; total: number };
