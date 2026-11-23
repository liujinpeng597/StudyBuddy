"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";

type SearchResult = {
  id: string;
  nodeId: string | null;
  title: string;
  snippet: string;
  path: string;
  type: "knowledge" | "source" | "leetcode";
  updatedAt: string;
  semantic?: boolean;
};

export function InlineSearch({
  variant,
  shortcut = false
}: {
  variant: "topbar" | "sidebar" | "mobile";
  shortcut?: boolean;
}) {
  const router = useRouter();
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [focused, setFocused] = useState(false);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  useEffect(() => {
    if (!shortcut) return;
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, [shortcut]);

  useEffect(() => {
    const searchTerm = query.trim();
    if (!focused || !searchTerm) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setState("loading");
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(searchTerm)}`, {
          signal: controller.signal
        });
        if (!response.ok) throw new Error("搜索失败");
        const data = (await response.json()) as { results: SearchResult[] };
        setResults(data.results);
        setActiveIndex(0);
        setState("ready");
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setState("error");
        }
      }
    }, 220);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, focused]);

  function openResult(result: SearchResult) {
    setFocused(false);
    setQuery("");
    if (result.nodeId) {
      router.push(`/knowledge/${result.nodeId}?highlight=${encodeURIComponent(query)}`);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setFocused(false);
      inputRef.current?.blur();
      return;
    }
    if (!results.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % results.length);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + results.length) % results.length);
    }
    if (event.key === "Enter" && results[activeIndex]) {
      event.preventDefault();
      openResult(results[activeIndex]);
    }
  }

  const showResults = focused && Boolean(query.trim());
  return (
    <div
      className={`inline-search ${variant === "sidebar" ? "in-sidebar" : variant}`}
      ref={containerRef}
    >
      <div className="inline-search-field">
        <Search size={16} aria-hidden="true" />
        <input
          ref={inputRef}
          role="combobox"
          aria-label={variant === "sidebar" ? "搜索知识" : "搜索知识点、问答或代码"}
          aria-autocomplete="list"
          aria-expanded={showResults}
          aria-controls={showResults ? listId : undefined}
          aria-activedescendant={
            showResults && results[activeIndex] ? `${listId}-${activeIndex}` : undefined
          }
          value={query}
          placeholder={variant === "sidebar" ? "搜索知识" : "搜索知识点、问答或代码"}
          onFocus={() => setFocused(true)}
          onChange={(event) => {
            const nextQuery = event.target.value;
            setQuery(nextQuery);
            if (!nextQuery.trim()) {
              setResults([]);
              setState("idle");
            }
          }}
          onKeyDown={handleKeyDown}
        />
        {query ? (
          <button
            type="button"
            className="inline-search-clear"
            aria-label="清空搜索"
            onClick={() => {
              setQuery("");
              setResults([]);
              setState("idle");
              inputRef.current?.focus();
            }}
          >
            <X size={15} />
          </button>
        ) : shortcut ? (
          <kbd>Ctrl K</kbd>
        ) : null}
      </div>
      {showResults ? (
        <div className="inline-search-results" id={listId} role="listbox" aria-label="搜索结果">
          {state === "loading" ? <div className="inline-search-status">正在匹配…</div> : null}
          {state === "error" ? (
            <div className="inline-search-status error-text">搜索暂时不可用</div>
          ) : null}
          {state === "ready" && results.length === 0 ? (
            <div className="inline-search-status">没有找到匹配内容</div>
          ) : null}
          {results.map((result, index) => (
            <Link
              id={`${listId}-${index}`}
              key={result.id}
              href={result.nodeId ? `/knowledge/${result.nodeId}` : "#"}
              role="option"
              aria-selected={index === activeIndex}
              className={`inline-search-result ${index === activeIndex ? "active" : ""}`}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={(event) => {
                if (!result.nodeId) {
                  event.preventDefault();
                  return;
                }
                openResult(result);
              }}
            >
              <span className="inline-search-result-main">
                <strong>
                  <HighlightedText text={result.title} query={query} />
                </strong>
                <span className="inline-search-path">{result.path}</span>
                <span className="inline-search-snippet">
                  <HighlightedText text={result.snippet} query={query} />
                </span>
              </span>
              <span className="badge">{labelForType(result.type)}</span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return text;
  const index = text.toLocaleLowerCase().indexOf(normalizedQuery.toLocaleLowerCase());
  if (index < 0) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + normalizedQuery.length)}</mark>
      {text.slice(index + normalizedQuery.length)}
    </>
  );
}

function labelForType(type: SearchResult["type"]) {
  if (type === "source") return "原始笔记";
  if (type === "leetcode") return "LeetCode";
  return "知识点";
}
