import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "知伴 · 学习搭子",
    short_name: "知伴",
    description: "把零散笔记整理成可复习、可连接的个人知识库",
    start_url: "/today",
    display: "standalone",
    background_color: "#F7F8F5",
    theme_color: "#F7F8F5",
    icons: [
      { src: "/icons/studybuddy-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/studybuddy-512.png", sizes: "512x512", type: "image/png" }
    ]
  };
}
