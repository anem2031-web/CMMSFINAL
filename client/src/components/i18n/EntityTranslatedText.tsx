import { useResolvedTranslation } from "@/hooks/useTranslatedField";

interface EntityTranslatedTextProps {
  entityType: string;
  entityId?: number | null;
  field: string;
  original?: string | null;
  originalLanguage?: string | null;
  as?: "span" | "div" | "p";
  className?: string;
}

/**
 * Localized display wrapper for user-authored workflow text.
 * The original value is always retained as the fallback while the existing
 * entity translation engine resolves the viewer's preferred language.
 */
export function EntityTranslatedText({
  entityType,
  entityId,
  field,
  original,
  originalLanguage,
  as: Tag = "span",
  className,
}: EntityTranslatedTextProps) {
  const { getField } = useResolvedTranslation(
    entityType,
    entityId ?? undefined,
    { [field]: original ?? "" },
    originalLanguage ?? undefined,
  );

  return <Tag className={className} dir="auto">{getField(field) || original || ""}</Tag>;
}
