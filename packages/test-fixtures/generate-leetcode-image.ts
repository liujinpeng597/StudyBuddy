import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="720">
  <rect width="1100" height="720" fill="#f8f9fa"/>
  <rect x="0" y="0" width="1100" height="64" fill="#ffffff"/>
  <text x="32" y="41" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#262626">Two Sum</text>
  <text x="32" y="100" font-family="Arial, sans-serif" font-size="18" fill="#555">1. Two Sum</text>
  <text x="32" y="138" font-family="Arial, sans-serif" font-size="16" fill="#333">Given an array of integers nums and an integer target,</text>
  <text x="32" y="166" font-family="Arial, sans-serif" font-size="16" fill="#333">return indices of the two numbers such that they add up to target.</text>
  <rect x="32" y="206" width="1036" height="460" rx="8" fill="#1e1e1e"/>
  <text x="56" y="244" font-family="Cascadia Code, monospace" font-size="17" fill="#d4d4d4">class Solution {</text>
  <text x="56" y="274" font-family="Cascadia Code, monospace" font-size="17" fill="#d4d4d4">public:</text>
  <text x="80" y="304" font-family="Cascadia Code, monospace" font-size="17" fill="#d4d4d4">vector&lt;int&gt; twoSum(vector&lt;int&gt;&amp; nums, int target) {</text>
  <text x="104" y="334" font-family="Cascadia Code, monospace" font-size="17" fill="#9cdcfe">unordered_map&lt;int, int&gt; seen;</text>
  <text x="104" y="364" font-family="Cascadia Code, monospace" font-size="17" fill="#d4d4d4">for (int i = 0; i &lt; nums.size(); ++i) {</text>
  <text x="128" y="394" font-family="Cascadia Code, monospace" font-size="17" fill="#ce9178">int need = target - nums[i];</text>
  <text x="128" y="424" font-family="Cascadia Code, monospace" font-size="17" fill="#d4d4d4">if (seen.count(need)) return {seen[need], i};</text>
  <text x="128" y="454" font-family="Cascadia Code, monospace" font-size="17" fill="#d4d4d4">seen[nums[i]] = i;</text>
  <text x="104" y="484" font-family="Cascadia Code, monospace" font-size="17" fill="#d4d4d4">}</text>
  <text x="104" y="514" font-family="Cascadia Code, monospace" font-size="17" fill="#d4d4d4">return {};</text>
  <text x="80" y="544" font-family="Cascadia Code, monospace" font-size="17" fill="#d4d4d4">}</text>
  <text x="56" y="574" font-family="Cascadia Code, monospace" font-size="17" fill="#d4d4d4">};</text>
</svg>`;

async function main() {
  const directory = path.join(import.meta.dirname, "images");
  await fs.mkdir(directory, { recursive: true });
  await sharp(Buffer.from(svg)).png().toFile(path.join(directory, "leetcode-two-sum.png"));
  console.log("LeetCode fixture generated");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
