"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// react-markdown never renders raw HTML from the source, so task
// descriptions are safe to display as-is. Styling is done with descendant
// selectors here because the storefront's global CSS is off-limits.
const prose = [
  "text-sm leading-relaxed text-ink break-words",
  "[&>*+*]:mt-3",
  "[&_h1]:font-display [&_h1]:text-lg [&_h2]:font-display [&_h2]:text-base [&_h3]:font-medium",
  "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li+li]:mt-1",
  "[&_a]:text-accent [&_a]:underline",
  "[&_code]:rounded [&_code]:bg-line/60 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]",
  "[&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-line/60 [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0",
  "[&_blockquote]:border-l-2 [&_blockquote]:border-line [&_blockquote]:pl-3 [&_blockquote]:text-graphite",
  "[&_hr]:border-line",
  "[&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_table]:text-xs",
  "[&_th]:border-b [&_th]:border-line [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-medium [&_th]:whitespace-nowrap",
  "[&_td]:border-b [&_td]:border-line/60 [&_td]:px-2 [&_td]:py-1.5 [&_td]:whitespace-nowrap",
].join(" ");

export default function Markdown({ source }: { source: string }) {
  return (
    <div className={prose}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
