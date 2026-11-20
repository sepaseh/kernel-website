import { exchangePreview } from "@/features/blog/preview";

type Context = { params: Promise<{ postId: string }> };
export async function GET(request: Request, { params }: Context) {
  return exchangePreview(request, (await params).postId);
}
