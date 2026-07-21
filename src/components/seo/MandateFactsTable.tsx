import { getTranslations } from "next-intl/server";
import { MANDATE_PHASES, PHASE_LABELS, formatMandateDate } from "@/content/mandate";
import type { Locale } from "@/lib/site";

/** Server-rendered phase/deadline table — the extractable "key facts" block
 * reused on guides and emirate pages so every citation carries current dates. */
export async function MandateFactsTable({ locale }: { locale: Locale }) {
  const t = await getTranslations("landing");
  return (
    <div className="overflow-x-auto rounded-2xl border border-ink-100 bg-white shadow-sm">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-ink-200 bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
            <th className="px-4 py-3 text-start font-semibold">{t("phaseCol")}</th>
            <th className="px-4 py-3 text-start font-semibold">{t("appointCol")}</th>
            <th className="px-4 py-3 text-start font-semibold">{t("goLiveCol")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-50">
          {MANDATE_PHASES.map((p) => {
            const pl = PHASE_LABELS[locale][p.key];
            return (
              <tr key={p.key} className="hover:bg-brand-50/30">
                <td className="px-4 py-3">
                  <span className="font-semibold text-ink-900">{pl.name}</span>
                  <span className="block text-xs text-ink-500">{pl.detail}</span>
                </td>
                <td className="px-4 py-3 text-ink-700">
                  {formatMandateDate(p.appointDeadlineIso, locale)}
                </td>
                <td className="px-4 py-3 font-semibold text-brand-800">
                  {formatMandateDate(p.goLiveIso, locale)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
