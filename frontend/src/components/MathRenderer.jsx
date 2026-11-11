import React, { useMemo } from 'react';
import katex from 'katex';

/**
 * MathRenderer: Takes a string that may contain LaTeX math:
 * - $...$ or \(...\) for inline math
 * - $$...$$ or \[...\] for display math
 * Renders HTML using KaTeX.
 */
export default function MathRenderer({ text, className = '' }) {
  const renderedContent = useMemo(() => {
    if (!text || typeof text !== 'string') return text || '';

    // Check if there is any math pattern
    const hasMath = /\\\(.*?\\\)|\\\[.*?\\\]|\$\$.*?\$\$|\$.*?\$|\\frac|\\sqrt/s.test(text);
    if (!hasMath) return text;

    try {
      // Split by math delimiters
      const regex = /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\$[^\$\n]+?\$|\\\(.*?\\\))/g;
      const parts = text.split(regex);

      return parts.map((part, index) => {
        if (!part) return null;

        // Display math $$...$$ or \[...\]
        if (part.startsWith('$$') && part.endsWith('$$')) {
          const formula = part.slice(2, -2).trim();
          const html = katex.renderToString(formula, { displayMode: true, throwOnError: false });
          return <span key={index} dangerouslySetInnerHTML={{ __html: html }} />;
        }
        if (part.startsWith('\\[') && part.endsWith('\\]')) {
          const formula = part.slice(2, -2).trim();
          const html = katex.renderToString(formula, { displayMode: true, throwOnError: false });
          return <span key={index} dangerouslySetInnerHTML={{ __html: html }} />;
        }

        // Inline math $...$ or \(...\)
        if (part.startsWith('$') && part.endsWith('$')) {
          const formula = part.slice(1, -1).trim();
          const html = katex.renderToString(formula, { displayMode: false, throwOnError: false });
          return <span key={index} dangerouslySetInnerHTML={{ __html: html }} />;
        }
        if (part.startsWith('\\(') && part.endsWith('\\)')) {
          const formula = part.slice(2, -2).trim();
          const html = katex.renderToString(formula, { displayMode: false, throwOnError: false });
          return <span key={index} dangerouslySetInnerHTML={{ __html: html }} />;
        }

        // Regular text
        return <span key={index}>{part}</span>;
      });
    } catch (e) {
      return text;
    }
  }, [text]);

  return <span className={`math-rendered-text ${className}`}>{renderedContent}</span>;
}

