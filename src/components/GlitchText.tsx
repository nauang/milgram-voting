interface GlitchTextProps {
  children: string;
  as?: "h1" | "h2" | "h3";
  className?: string;
}

/**
 * Texto com efeito glitch RGB — replica o `mgGlitch` do site oficial.
 * Duas cópias do texto com clip-path + cor magenta/ciano, animação curta.
 * Desligado automaticamente em `prefers-reduced-motion`.
 */
export function GlitchText({ children, as: Tag = "h1", className = "" }: GlitchTextProps) {
  return (
    <Tag className={`glitch relative inline-block ${className}`} data-text={children}>
      {children}
    </Tag>
  );
}
