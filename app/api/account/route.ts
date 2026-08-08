import { apiError, prepareRequest } from "../_lib";

export async function DELETE(request: Request) {
  try {
    const context = await prepareRequest(request);
    if (context instanceof Response) return context;
    const now = new Date().toISOString();
    await context.db.batch([
      context.db
        .prepare("DELETE FROM subscriptions WHERE user_id = ?")
        .bind(context.user.userId),
      context.db
        .prepare(
          "DELETE FROM user_blocks WHERE blocker_user_id = ? OR blocked_user_id = ?",
        )
        .bind(context.user.userId, context.user.userId),
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
          "UPDATE profiles SET deletion_requested_at = ?, updated_at = ? WHERE user_id = ?",
        )
        .bind(now, now, context.user.userId),
      context.db
        .prepare(
          "UPDATE duties SET deleted_at = ?, updated_at = ? WHERE user_id = ? AND deleted_at IS NULL",
        )
        .bind(now, now, context.user.userId),
      context.db
        .prepare(
          "UPDATE invite_codes SET revoked_at = ? WHERE issuer_user_id = ? AND used_at IS NULL AND revoked_at IS NULL",
        )
        .bind(now, context.user.userId),
      context.db
        .prepare(
          "DELETE FROM active_memberships WHERE connection_id IN (SELECT id FROM connections WHERE user_low_id = ? OR user_high_id = ?)",
        )
        .bind(context.user.userId, context.user.userId),
      context.db
        .prepare(
          "UPDATE connections SET status = 'unlinked', unlinked_at = ? WHERE (user_low_id = ? OR user_high_id = ?) AND status = 'active'",
        )
        .bind(now, context.user.userId, context.user.userId),
    ]);
    return Response.json({ deletionRequestedAt: now });
  } catch (error) {
    return apiError(error, "계정 삭제 요청을 처리하지 못했어요.");
  }
}
