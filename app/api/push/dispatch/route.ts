import { apiError, prepareRequest } from "../../_lib";
import { dispatchDueForUser } from "../../_push";

export async function POST(request: Request) {
  try {
    const context = await prepareRequest(request);
    if (context instanceof Response) return context;
    const sent = await dispatchDueForUser(context.db, context.user.userId);
    return Response.json({ sent });
  } catch (error) {
    return apiError(error, "예약 알림을 확인하지 못했어요.");
  }
}
