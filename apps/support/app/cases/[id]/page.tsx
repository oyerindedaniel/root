import { CaseDetail } from "./case-detail";

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CaseDetail id={id} />;
}
