import {
  apiError,
  freeRosterImportsLeft,
  getSubscription,
  prepareRequest,
  syncRevenueCat,
} from "../_lib";

async function summary(db: D1Database, userId: string) {
  return Response.json({
    subscription: await getSubscription(db, userId),
    freeRosterImportsLeft: await freeRosterImportsLeft(db, userId),
  });
}

export async function GET(request: Request) {
  try {
    const context = await prepareRequest(request);
    if (context instanceof Response) return context;
    return summary(context.db, context.user.userId);
  } catch (error) {
    return apiError(error, "구독 정보를 불러오지 못했어요.");
  }
}

// 결제·복원 직후 앱이 호출한다. 클라이언트가 보낸 값은 믿지 않고 RevenueCat에 직접 확인한다.
export async function POST(request: Request) {
  try {
    const context = await prepareRequest(request);
    if (context instanceof Response) return context;
    await syncRevenueCat(context.db, context.user.userId);
    return summary(context.db, context.user.userId);
  } catch (error) {
    return apiError(error, "구독 상태를 확인하지 못했어요.");
  }
}
