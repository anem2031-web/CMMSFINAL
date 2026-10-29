import { PreparedIssueForm } from "./PreparedIssueForm";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import {
  canCreateOperationalIssue,
  canReadOperationalIssue,
} from "@shared/operational-issues";
import { operationalIssueText } from "@/i18n/operationalIssues";
import { OperationalIssueQueue } from "./OperationalIssueQueue";

export default function OperationalIssues() {
  const { user } = useAuth();
  const { language, dir } = useTranslation();
  const text = operationalIssueText[language];
  const allowed = user?.isActive === 1 && canReadOperationalIssue(user.role);
  const status = trpc.operationalIssues.status.useQuery(undefined, {
    enabled: allowed,
    retry: false,
  });
  if (!allowed) return <p role="alert">{text.forbidden}</p>;
  return (
    <div className="p-6 space-y-5" dir={dir}>
      <h1 className="text-2xl font-bold">{text.title}</h1>
      {status.error ? (
        <p role="alert">{status.error.message}</p>
      ) : status.isLoading ? (
        <p>{text.load}</p>
      ) : status.data?.enabled ? (
        <>
          {canCreateOperationalIssue(user.role) && <PreparedIssueForm />}
          <OperationalIssueQueue />
        </>
      ) : (
        <p>{text.disabled}</p>
      )}
    </div>
  );
}
