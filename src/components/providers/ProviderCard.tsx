import { Link } from "@/i18n/navigation";
import type { Provider } from "@/db/schema";

const AVATAR_COLORS = [
  "bg-brand-700",
  "bg-ink-700",
  "bg-accent-600",
  "bg-brand-900",
  "bg-ink-500",
];

export function ProviderCard({
  provider,
  labels,
}: {
  provider: Pick<
    Provider,
    "slug" | "name" | "nameAr" | "website" | "description" | "descriptionAr" | "status"
  >;
  labels: { visitWebsite: string; viewProfile: string; delistedBadge: string };
}) {
  const color =
    AVATAR_COLORS[
      Math.abs(
        provider.slug.split("").reduce((a, c) => a + c.charCodeAt(0), 0),
      ) % AVATAR_COLORS.length
    ];

  return (
    <article className="card-hover group flex h-full flex-col rounded-2xl border border-ink-100 bg-white p-5 transition-transform">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={`grid size-11 shrink-0 place-items-center rounded-xl text-lg font-bold text-white transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3 ${color}`}
        >
          {provider.name.charAt(0)}
        </span>
        <div className="min-w-0">
          <h3 className="font-semibold leading-snug text-ink-900">
            <Link
              href={`/providers/${provider.slug}`}
              className="after:absolute after:inset-0 group-hover:text-brand-800"
            >
              {provider.name}
            </Link>
          </h3>
          {provider.status === "delisted" && (
            <span className="mt-1 inline-block rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-medium text-ink-500">
              {labels.delistedBadge}
            </span>
          )}
        </div>
      </div>
      {provider.description && (
        <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-ink-600">
          {provider.description}
        </p>
      )}
      <div className="relative mt-auto flex items-center gap-4 pt-4 text-sm font-medium">
        <span className="text-brand-700 transition-colors group-hover:text-brand-900">
          {labels.viewProfile}{" "}
          <span
            aria-hidden
            className="inline-block transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
          >
            →
          </span>
        </span>
      </div>
    </article>
  );
}
