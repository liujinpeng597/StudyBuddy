import "dotenv/config";
import { randomUUID } from "node:crypto";
import { hashPassword } from "@studybuddy/core";
import { withTransaction } from "@studybuddy/db";

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed a test user in production");
  const passwordHash = await hashPassword("studybuddy-local-test-2026");
  await withTransaction(async (client) => {
    await client.query("DELETE FROM users WHERE email = 'test@studybuddy.local'");
    const userResult = await client.query<{ id: string }>(
      "INSERT INTO users (email, password_hash) VALUES ('test@studybuddy.local', $1) RETURNING id",
      [passwordHash]
    );
    const userId = userResult.rows[0]?.id;
    if (!userId) throw new Error("E2E user creation failed");
    await client.query(
      `INSERT INTO user_preferences
         (user_id, directory_default_expanded, mindmap_default_expanded)
       VALUES ($1, true, true)`,
      [userId]
    );
    const moduleId = randomUUID();
    const linuxModuleId = randomUUID();
    const processTopicId = randomUUID();
    const ipcTopicId = randomUUID();
    const virtualId = randomUUID();
    const polymorphismId = randomUUID();
    const jobId = randomUUID();
    const sections = {
      definition: "虚函数允许通过基类指针或引用，根据对象的动态类型选择派生类实现。",
      purpose: "支持运行时多态。",
      implementation: "基类使用 virtual 声明，派生类使用 override 实现。",
      useCases: "接口抽象和运行时行为替换。",
      rationale: "让调用方依赖稳定接口。",
      advantages: "扩展新类型时无需修改调用方。",
      disadvantages: "存在动态分派和对象布局成本。",
      relatedPoints: "继承、多态和虚析构函数。",
      differences: "重载发生在同一作用域，重写发生在基类与派生类之间。"
    };
    await client.query(
      "INSERT INTO knowledge_modules (id, user_id, kind, name) VALUES ($1, $2, 'module', 'C++')",
      [moduleId, userId]
    );
    await client.query(
      `INSERT INTO knowledge_modules (id, user_id, parent_id, kind, name)
       VALUES
         ($1, $4, NULL, 'module', 'Linux'),
         ($2, $4, $1, 'topic', '进程管理'),
         ($3, $4, $2, 'topic', '进程间通信')`,
      [linuxModuleId, processTopicId, ipcTopicId, userId]
    );
    await client.query(
      `INSERT INTO knowledge_nodes
         (id, user_id, module_id, canonical_title, summary, sections, aliases)
       VALUES
         ($1, $3, $4, 'C++ 虚函数', $5, $6, ARRAY['virtual function']),
         ($2, $3, $4, 'C++ 多态', $7, $8, ARRAY['polymorphism'])`,
      [
        virtualId,
        polymorphismId,
        userId,
        moduleId,
        "虚函数是实现运行时多态的核心机制。",
        JSON.stringify(sections),
        "多态让同一接口在不同对象上产生不同行为。",
        JSON.stringify({ ...sections, definition: "多态是同一接口在不同动态类型上表现不同行为。" })
      ]
    );
    await client.query(
      `INSERT INTO knowledge_nodes
         (user_id, module_id, canonical_title, summary, sections)
       VALUES
         ($1, $2, '匿名管道', '匿名管道用于具有亲缘关系的进程之间进行单向字节流通信。', $3),
         ($1, $2, '消息队列', '消息队列允许进程按消息边界发送和接收数据。', $3)`,
      [
        userId,
        ipcTopicId,
        JSON.stringify(sections)
      ]
    );
    await client.query(
      `INSERT INTO knowledge_relations
         (user_id, source_id, target_id, type, confidence, origin)
       VALUES ($1, $2, $3, 'prerequisite', 0.9, 'fixture')`,
      [userId, virtualId, polymorphismId]
    );
    await client.query(
      `INSERT INTO import_jobs
         (id, user_id, status, progress, study_date, summary, question_status, finished_at)
       VALUES ($1, $2, 'completed', 100, CURRENT_DATE, $3, 'completed', now())`,
      [
        jobId,
        userId,
        JSON.stringify({
          createdNodes: [
            { id: virtualId, title: "C++ 虚函数" },
            { id: polymorphismId, title: "C++ 多态" }
          ],
          updatedNodes: [],
          newRelations: [{ source: "C++ 虚函数", target: "C++ 多态", type: "prerequisite" }],
          needsReview: [],
          sourceCount: 1,
          problemCount: 1,
          questionCount: 2
        })
      ]
    );
    await client.query(
      `INSERT INTO questions
         (user_id, import_job_id, type, prompt, options, answer_key, correct_indexes,
          explanation, rubric, source_node_ids)
       VALUES
         ($1, $2, 'single_choice', '以下哪项最符合虚函数的作用？', $3::jsonb, $6::jsonb, ARRAY[0], '虚函数支持运行时多态。', '[]'::jsonb, ARRAY[$4::uuid]),
         ($1, $2, 'short_answer', '请解释虚函数和多态的关系。', '[]'::jsonb, $7::jsonb, '{}', '应从继承、基类接口和动态分派三个角度回答。', $5::jsonb, ARRAY[$4::uuid])`,
      [
        userId,
        jobId,
        JSON.stringify(["通过动态类型选择实现", "让变量自动变为常量", "修改编译器版本", "替代所有模板"]),
        virtualId,
        JSON.stringify([
          "虚函数允许基类接口调用派生类实现",
          "多态依赖对象动态类型",
          "重写需要兼容的函数签名"
        ]),
        JSON.stringify("通过动态类型选择实现"),
        JSON.stringify("虚函数是实现运行时多态的方法。")
      ]
    );
    await client.query(
      `INSERT INTO search_documents
         (user_id, document_type, title, body, node_id)
       VALUES
         ($1, 'knowledge', 'C++ 虚函数', $2, $3),
         ($1, 'knowledge', 'C++ 多态', $4, $5)`,
      [
        userId,
        JSON.stringify(sections),
        virtualId,
        "多态让同一接口在不同对象上产生不同行为。",
        polymorphismId
      ]
    );
  });
  console.log("e2e user ready");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
