import { KnowledgeReader } from "@/components/knowledge/knowledge-reader";

export default async function KnowledgePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <KnowledgeReader nodeId={id} />;
}
