import { useLanguage } from "@/contexts/LanguageContext";
import { useResolvedTranslation } from "@/hooks/useTranslatedField";
import { localizePmv2ServerText } from "@/i18n/pmv2Ui";

interface Props {
  value?: string | null;
  taskItemId?: number | null;
  taskItemTitle?: string | null;
  className?: string;
}

/**
 * Localizes PM V2 timeline server text while also replacing any user-authored
 * task-item title embedded in the server message with the viewer-language
 * translation from the existing entity translation engine.
 */
export function Pmv2LocalizedTimelineText({
  value,
  taskItemId,
  taskItemTitle,
  className,
}: Props) {
  const { language } = useLanguage();
  const { getField } = useResolvedTranslation(
    "PMV2_TASK_ITEM",
    taskItemId ?? undefined,
    { titleSnapshot: taskItemTitle ?? "" },
  );

  const originalTitle = taskItemTitle ?? "";
  const localizedTitle = getField("titleSnapshot") || originalTitle;
  let text = localizePmv2ServerText(language, value);

  if (originalTitle && localizedTitle && localizedTitle !== originalTitle) {
    text = text.replaceAll(originalTitle, localizedTitle);
  }

  return <span className={className} dir="auto">{text}</span>;
}
