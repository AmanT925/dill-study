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
    const hasInlineMath = content.match(/\$[^$\n]+?\$/);
    const hasBlockMath = content.match(/\$\$[\s\S]+?\$\$/);

    if (!hasInlineMath && !hasBlockMath) {
      return <span className={className}>{content}</span>;
    }

    if (block || hasBlockMath) {
      // Split content by block math delimiters and render each part
      const parts = content.split(/(\$\$[\s\S]+?\$\$)/g);
      return (
        <div className={className}>
          {parts.map((part, index) => {
            const trimmedPart = part.trim();
            if (trimmedPart.startsWith("$$") && trimmedPart.endsWith("$$")) {
              // Remove $$ delimiters and render as block math
              const math = trimmedPart.slice(2, -2).trim();
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
  const parts = text.split(/(\$[^$\n]+?\$)/g);
  return parts.map((part, index) => {
    const trimmedPart = part.trim();
    if (trimmedPart.startsWith("$") && trimmedPart.endsWith("$") && !trimmedPart.includes("$$")) {
      // Remove $ delimiters and render as inline math
      const math = trimmedPart.slice(1, -1).trim();
      try {
        return <InlineMath key={index} math={math} />;
      } catch (error) {
        console.error("LaTeX inline math error:", error);
        return part;
      }
    }
    return part;
  });
}