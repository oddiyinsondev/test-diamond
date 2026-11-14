import React, { useMemo } from 'react';
import katex from 'katex';

/**
 * MathRenderer: Takes a string that may contain LaTeX math or bare math formulas:
 * - $...$ or \(...\) for inline math
 * - $$...$$ or \[...\] for display math
 * - Bare LaTeX formulas: \frac{a}{b}, \sqrt{x}, \times, \pm, etc.
 * - Simple fractions: 9/6, 5/3, etc.
 * Renders HTML using KaTeX.
 */
export default function MathRenderer({ text, className = '' }) {
  const renderedContent = useMemo(() => {
    if (!text || typeof text !== 'string') return text || '';

    // Handle double-escaped backslashes (e.g. \\frac -> \frac)
    let clean = text.replace(/\\\\([a-zA-Z]+)/g, '\\$1');

    // Auto-convert standalone or math-context simple fractions like "9/6" or "5/3" into \frac{a}{b}
    clean = clean.replace(/(^|[\s+\-*=:(])(\d+)\/(\d+)(?=[\s+\-*=:,)]|$)/g, '$1\\frac{$2}{$3}');

    // Check if there is any math pattern
    const hasMath =
      /\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\$[^$\n]+?\$|\\\(.*?\\\)|\\[a-zA-Z]+/.test(clean);

    if (!hasMath) return clean;

    try {
      // Split by math delimiters and bare LaTeX expressions
      const tokenRegex =
        /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\$[^$\n]+?\$|\\\(.*?\\\)|(?:[0-9a-zA-Z.]+\s*[\+\-\*\/\=]\s*)?\\(?:frac|sqrt|cdot|times|pm|le|ge|neq|div|approx|alpha|beta|pi|sum|int|infty)\b(?:\{[^{}]*\}|\[[^{}]*\]|[^{}\s])*(?:\s*[\+\-\*\/\=]\s*(?:\\(?:frac|sqrt|cdot|times|pm|le|ge|neq|div|approx|alpha|beta|pi|sum|int|infty)\b(?:\{[^{}]*\}|\[[^{}]*\]|[^{}\s])*|[0-9a-zA-Z.]+(?:\{[^{}]*\})?))*)/g;

      const parts = clean.split(tokenRegex);

      return parts.map((part, index) => {
        if (!part) return null;

        let formula = part;
        let displayMode = false;
        let isMath = false;

        // Display math $$...$$ or \[...\]
        if (formula.startsWith('$$') && formula.endsWith('$$')) {
          formula = formula.slice(2, -2).trim();
          displayMode = true;
          isMath = true;
        } else if (formula.startsWith('\\[') && formula.endsWith('\\]')) {
          formula = formula.slice(2, -2).trim();
          displayMode = true;
          isMath = true;
        } else if (formula.startsWith('$') && formula.endsWith('$')) {
          // Inline math $...$
          formula = formula.slice(1, -1).trim();
          isMath = true;
        } else if (formula.startsWith('\\(') && formula.endsWith('\\)')) {
          // Inline math \(...\)
          formula = formula.slice(2, -2).trim();
          isMath = true;
        } else if (/\\(?:frac|sqrt|cdot|times|pm|le|ge|neq|div|approx|alpha|beta|pi|sum|int|infty)/.test(formula)) {
          // Bare formula
          formula = formula.trim();
          isMath = true;
        }

        if (isMath && formula) {
          try {
            const html = katex.renderToString(formula, { displayMode, throwOnError: false });
            return (
              <span
                key={index}
                className={displayMode ? 'katex-display-wrapper' : 'katex-inline-wrapper'}
                dangerouslySetInnerHTML={{ __html: html }}
              />
            );
          } catch {
            return <span key={index}>{part}</span>;
          }
        }

        // Regular text
        return <span key={index}>{part}</span>;
      });
    } catch {
      return text;
    }
  }, [text]);

  return <span className={`math-rendered-text ${className}`}>{renderedContent}</span>;
}
