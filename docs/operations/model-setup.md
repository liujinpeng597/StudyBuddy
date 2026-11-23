# 模型接入

## DeepSeek V4.1 Flash

在“模型设置”填写：

- 显示名称：`DeepSeek V4.1 Flash`
- Base URL：服务商提供的 OpenAI 兼容根地址，例如 `https://provider.example/v1`
- API Model ID：服务商控制台显示的准确标识
- API Key：只由服务端加密保存

先测试文本与 JSON。需要导入 LeetCode 截图时，再测试图片；需要语义搜索时，再测试向量。

模型名称相似不代表能力相同。应用不会根据名称推断支持图片或 embedding，只使用连接测试通过的绑定。

## 更换密钥

1. 在模型设置中编辑档案并填写新密钥。
2. 重新测试能力。
3. 测试通过后再删除旧密钥。

## 主密钥轮换

1. 在服务端环境变量中同时加入旧、新密钥，并把 `SECRET_BOX_ACTIVE_KEY_ID` 切到新值。
2. 先运行 `pnpm exec tsx scripts/rotate-secret-box.ts` 查看数量。
3. 运行 `pnpm exec tsx scripts/rotate-secret-box.ts --apply`。
4. 验证模型测试通过后，从环境变量移除旧主密钥。
