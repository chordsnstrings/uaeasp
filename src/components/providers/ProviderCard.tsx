import { Link } from "@/i18n/navigation";
import type { Provider } from "@/db/schema";
import { Arrow } from "@/components/ui";

/**
 * One entry in the register.
 *
 * Not a "card" in the marketing sense — there is no image, no logo, no
 * rounded corner and nothing that lifts. What separates it from the linen is
 * that it is white and that it has a hairline around it, and what separates
 * one from the next is the serial number in the corner. Read down a grid of
 * them and the numbers do the work a heavier design would ask colour to do.
 *
 * The domain sits in the bottom corner in mono, because on a directory the
 * question a reader is actually asking is "who is this", and the domain
 * answers it faster than any description we could write.
 */
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
  const delisted = provider.status === "delisted";
  return (
    <article className="card-hover group relative flex h-full min-w-0 flex-col border border-ink-200 bg-white p-6 hover:border-ink-900">
      <div className="flex items-start justify-between gap-3">
        {serial !== undefined && (
          <span className="num text-[11px] text-ink-500" dir="ltr">
            {String(serial).padStart(2, "0")}
          </span>
        )}
        {delisted ? (
          <span className="stamp text-ink-500">{labels.delistedBadge}</span>
        ) : (
          <span className="stamp text-brand-600">MoF</span>
        )}
      </div>

      <h3 className="mt-5 break-words text-[17px] font-medium leading-snug tracking-tight text-ink-900">
        <Link
          href={`/providers/${provider.slug}`}
          className="after:absolute after:inset-0 group-hover:text-brand-800"
        >
          {provider.name}
        </Link>
      </h3>

      {provider.description && (
        <p className="mb-6 mt-2.5 line-clamp-3 text-[13px] leading-relaxed text-ink-600">
          {provider.description}
        </p>
      )}

      <div className="relative mt-auto flex items-center justify-between gap-4 border-t border-ink-200 pt-4 text-[13px]">
        <span className="text-ink-800 group-hover:text-brand-800">
          {labels.viewProfile} <Arrow />
        </span>
        {provider.website && (
          <span className="num max-w-[45%] truncate text-[11px] text-ink-500" dir="ltr">
            {provider.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
          </span>
        )}
      </div>
    </article>
  );
}
