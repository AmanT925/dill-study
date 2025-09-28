import "katex/dist/katex.min.css";
import { InlineMath, BlockMath } from "react-katex";

interface LatexProps {
  content: string;
  block?: boolean;
  className?: string;
}

export function Latex({ content, block = false, className = "" }: LatexProps) {
  if (!content) return null;

  try {
    // Detect if the content contains LaTeX by looking for common delimiters
    const hasInlineMath = content.includes("$") && !content.includes("$$");
    const hasBlockMath = content.includes("$$");

    if (!hasInlineMath && !hasBlockMath) {
      return <span className={className}>{content}</span>;
    }

    if (block || hasBlockMath) {
      // Split content by block math delimiters and render each part
      const parts = content.split(/(\$\$[^$]+\$\$)/g);
      return (
        <div className={className}>
          {parts.map((part, index) => {
            if (part.startsWith("$$") && part.endsWith("$$")) {
              // Remove $$ delimiters and render as block math
              const math = part.slice(2, -2);
              return <BlockMath key={index} math={math} />;
            }
            // For non-math parts, check for inline math
            return (
              <span key={index}>
                {renderInlineMath(part)}
              </span>
            );
          })}
        </div>
      );
    }

    // Only inline math present
    return (
      <span className={className}>
        {renderInlineMath(content)}
      </span>
    );
  } catch (error) {
    console.error("LaTeX rendering error:", error);
    return <span className={className}>{content}</span>;
  }
}

function renderInlineMath(text: string) {
  // Split by inline math delimiters and render each part
  const parts = text.split(/(\$[^$]+\$)/g);
  return parts.map((part, index) => {
    if (part.startsWith("$") && part.endsWith("$")) {
      // Remove $ delimiters and render as inline math
      const math = part.slice(1, -1);
      return <InlineMath key={index} math={math} />;
    }
    return part;
  });
}