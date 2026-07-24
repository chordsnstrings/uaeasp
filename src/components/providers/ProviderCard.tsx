import { Link } from "@/i18n/navigation";
import type { Provider } from "@/db/schema";

/** A registry entry, not a "card": serial number, stamped status, hairline
 * borders — styled like a line item on an official list. */
export function ProviderCard({
  provider,
  labels,
  serial,
}: {
  provider: Pick<
    Provider,
    "slug" | "name" | "nameAr" | "website" | "description" | "descriptionAr" | "status"
  >;
  labels: { visitWebsite: string; viewProfile: string; delistedBadge: string };
  serial?: number;
}) {
  return (
    <article className="card-hover group relative flex h-full min-w-0 flex-col rounded-xl border border-ink-200 bg-white p-5 transition-transform hover:border-ink-900">
      <div className="flex items-start justify-between gap-3">
        {serial !== undefined && (
          <span className="num text-xs font-medium text-ink-400" dir="ltr">
            № {String(serial).padStart(2, "0")}
          </span>
        )}
        {provider.status === "delisted" ? (
          <span className="stamp text-[9px] text-ink-400">{labels.delistedBadge}</span>
        ) : (
          <span className="stamp text-[9px] text-brand-700 opacity-70 transition-opacity group-hover:opacity-100">
            MoF
          </span>
        )}
      </div>
      <h3 className="mt-2.5 break-words text-lg font-semibold leading-snug text-ink-900">
        <Link
          href={`/providers/${provider.slug}`}
          className="after:absolute after:inset-0 group-hover:text-brand-800"
        >
          {provider.name}
        </Link>
      </h3>
      {provider.description && (
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink-600">
          {provider.description}
        </p>
      )}
      <div className="relative mt-auto flex items-center justify-between gap-4 border-t border-dashed border-ink-200 pt-3.5 text-sm font-medium">
        <span className="text-brand-700 transition-colors group-hover:text-brand-900">
          {labels.viewProfile}{" "}
          <span
            aria-hidden
            className="inline-block transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
          >
            →
          </span>
        </span>
        {provider.website && (
          <span className="num max-w-[45%] truncate text-[11px] text-ink-400" dir="ltr">
            {provider.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
          </span>
        )}
      </div>
    </article>
  );
}
