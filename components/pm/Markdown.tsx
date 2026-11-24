import ReactMarkdown from "react-markdown";

// Renders task descriptions. react-markdown never renders raw HTML, so
// user-entered markdown cannot inject markup or scripts.
const styles = [
  "break-words text-sm leading-relaxed text-ink",
  "[&>*+*]:mt-3",
  "[&_h1]:font-display [&_h1]:text-lg [&_h2]:font-display [&_h2]:text-base [&_h3]:font-medium",
  "[&_a]:text-accent [&_a]:underline",
  "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li+li]:mt-1",
  "[&_code]:rounded [&_code]:bg-line/50 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]",
  "[&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-line/50 [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0",
  "[&_blockquote]:border-l-2 [&_blockquote]:border-line [&_blockquote]:pl-3 [&_blockquote]:text-graphite",
  "[&_hr]:border-line",
].join(" ");

export default function Markdown({ children }: { children: string }) {
  return (
    <div className={styles}>
      <ReactMarkdown
        components={{
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow">
              {children}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
