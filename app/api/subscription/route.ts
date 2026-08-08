import { apiError, getSubscription, prepareRequest } from "../_lib";

export async function GET(request: Request) {
  try {
    const context = await prepareRequest(request);
    if (context instanceof Response) return context;
    return Response.json({ subscription: await getSubscription(context.db, context.user.userId) });
  } catch (error) {
    return apiError(error, "구독 정보를 불러오지 못했어요.");
  }
}
