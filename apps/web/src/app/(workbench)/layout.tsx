import { requireUser } from "@/lib/server/auth";
import { getDisplayPreferences, getKnowledgeTree } from "@/lib/server/tree";
import { WorkbenchShell } from "@/components/workbench/workbench-shell";

export default async function WorkbenchLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [tree, preferences] = await Promise.all([
    getKnowledgeTree(user.id),
    getDisplayPreferences(user.id)
  ]);
  return (
    <WorkbenchShell user={user} initialTree={tree} initialPreferences={preferences}>
      {children}
    </WorkbenchShell>
  );
}
