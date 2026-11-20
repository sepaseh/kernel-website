import { publicMedia } from "@/features/blog/media";

type Context = { params: Promise<{ fileId: string }> };
export async function GET(request: Request, { params }: Context) {
  return publicMedia(request, (await params).fileId);
}
