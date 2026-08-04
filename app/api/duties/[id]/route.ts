import { apiError, prepareRequest } from "../../_lib";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await prepareRequest(request);
    if (context instanceof Response) return context;
    const { id } = await params;
    const now = new Date().toISOString();
    const result = await context.db
      .prepare(
        "UPDATE duties SET deleted_at = ?, updated_at = ?, version = version + 1 WHERE id = ? AND user_id = ? AND deleted_at IS NULL",
      )
      .bind(now, now, id, context.user.userId)
      .run();
    if (!result.meta.changes)
      return Response.json(
        { error: "일정을 찾을 수 없어요." },
        { status: 404 },
      );
    return Response.json({ deleted: true });
  } catch (error) {
    return apiError(error, "일정을 삭제하지 못했어요.");
  }
}
