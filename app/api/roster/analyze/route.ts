export async function POST() {
  return Response.json(
    { error: "PDF 원본 업로드는 보안상 지원하지 않습니다. 기기 내 분석을 이용해주세요." },
    { status: 410 },
  );
}
