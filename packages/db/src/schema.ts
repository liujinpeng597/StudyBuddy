export const schemaVersion = 1;

export type UserRow = {
  id: string;
  email: string;
  password_hash: string;
};

export type KnowledgeNodeRow = {
  id: string;
  user_id: string;
  module_id: string | null;
  canonical_title: string;
  summary: string;
  sections: Record<string, string>;
  aliases: string[];
  review_status: "active" | "needs_review";
};
