import { forwardApiRequest } from "@/shared/api/proxy";
type Context = { params: Promise<{ path: string[] }> };
async function handle(request: Request, context: Context) {
  return forwardApiRequest(request, (await context.params).path);
}
export {
  handle as DELETE,
  handle as GET,
  handle as PATCH,
  handle as POST,
  handle as PUT,
};
