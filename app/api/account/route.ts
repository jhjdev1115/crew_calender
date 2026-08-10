import { apiError, prepareRequest } from "../_lib";

export async function DELETE(request: Request) {
  try {
    const context = await prepareRequest(request);
    if (context instanceof Response) return context;
    await context.db.batch([
      context.db
        .prepare(
          "DELETE FROM notification_deliveries WHERE subscription_id IN (SELECT id FROM push_subscriptions WHERE user_id = ?)",
        )
        .bind(context.user.userId),
      context.db
        .prepare("DELETE FROM push_subscriptions WHERE user_id = ?")
        .bind(context.user.userId),
      context.db
        .prepare(
          "DELETE FROM active_memberships WHERE connection_id IN (SELECT id FROM connections WHERE user_low_id = ? OR user_high_id = ?)",
        )
        .bind(context.user.userId, context.user.userId),
      context.db
        .prepare(
          "DELETE FROM connections WHERE user_low_id = ? OR user_high_id = ?",
        )
        .bind(context.user.userId, context.user.userId),
      context.db
        .prepare(
          "DELETE FROM user_blocks WHERE blocker_user_id = ? OR blocked_user_id = ?",
        )
        .bind(context.user.userId, context.user.userId),
      context.db
        .prepare("DELETE FROM invite_codes WHERE issuer_user_id = ?")
        .bind(context.user.userId),
      context.db
        .prepare("DELETE FROM duties WHERE user_id = ?")
        .bind(context.user.userId),
      context.db
        .prepare("DELETE FROM notification_preferences WHERE user_id = ?")
        .bind(context.user.userId),
      context.db
        .prepare("DELETE FROM subscriptions WHERE user_id = ?")
        .bind(context.user.userId),
      context.db
        .prepare("DELETE FROM profiles WHERE user_id = ?")
        .bind(context.user.userId),
    ]);
    return Response.json({ deleted: true });
  } catch (error) {
    return apiError(error, "계정 삭제 요청을 처리하지 못했어요.");
  }
}
