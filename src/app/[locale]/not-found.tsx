import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function NotFoundPage() {
  const t = useTranslations("notFound");
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
      <p className="text-7xl font-black text-brand-100">404</p>
      <h1 className="mt-4 text-2xl font-bold text-ink-900">{t("title")}</h1>
      <p className="mt-2 text-ink-600">{t("body")}</p>
      <Link
        href="/"
        className="press mt-8 inline-block rounded-xl bg-brand-700 px-6 py-3 font-semibold text-white hover:bg-brand-800"
      >
        {t("backHome")}
      </Link>
    </div>
  );
}
