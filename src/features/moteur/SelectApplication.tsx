import { useTranslation } from "react-i18next";

import { nomApplication, type ApplicationOs } from "./applications";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function SelectApplication({
  id,
  applications,
  value,
  onChange,
  allowTous,
  required,
  className,
}: {
  id?: string;
  applications: ApplicationOs[];
  value: string;
  onChange: (slug: string) => void;
  allowTous?: boolean;
  required?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <select
      id={id}
      className={className ?? selectClass}
      value={value}
      required={required}
      onChange={(e) => onChange(e.target.value)}
    >
      {allowTous && <option value="tous">{t("applications.filtreTous")}</option>}
      {applications.map((app) => (
        <option key={app.id} value={app.slug}>
          {nomApplication(app)}
        </option>
      ))}
    </select>
  );
}
