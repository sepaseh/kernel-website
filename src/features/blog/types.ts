export type BlogImage = {
  id: string;
  content_type: "image/jpeg" | "image/png";
  width?: number;
  height?: number;
};
export type BlogCategory = {
  id: string;
  name: string;
  description: string;
};
type BlogTag = { id: string; name: string };
export type BlogPost = {
  id: number;
  title: string;
  excerpt: string;
  url_title: string;
  cover_image?: BlogImage;
  category?: BlogCategory;
  tags: BlogTag[];
  published_at?: string;
  public_updated_at?: string;
};
export type BlogArticle = BlogPost & { body: string };
export type BlogList = { items: BlogPost[]; total: number };
export type BlogSitemapItem = Pick<BlogPost, "id" | "url_title"> & {
  public_updated_at: string;
};
