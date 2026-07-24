import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { SITE_NAME } from "@/lib/site";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const title =
    req.nextUrl.searchParams.get("title")?.slice(0, 140) ?? SITE_NAME;
  const locale = req.nextUrl.searchParams.get("locale") === "ar" ? "ar" : "en";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background: "#042f2e",
          borderBottom: "10px solid #f59e0b",
          color: "white",
          fontFamily: "sans-serif",
          direction: locale === "ar" ? "rtl" : "ltr",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "#f59e0b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#042f2e",
            }}
          >
            <svg
              width={38}
              height={38}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#042f2e"
              strokeWidth={1.9}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 3h12v18l-2-1.4L14 21l-2-1.4L10 21l-2-1.4L6 21V3z" />
              <path d="M9 7.5h6M9 11h6" />
              <path d="M9.5 15.5l1.8 1.8 3.2-3.6" />
            </svg>
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, opacity: 0.95 }}>{SITE_NAME}</div>
        </div>
        <div
          style={{
            fontSize: title.length > 70 ? 52 : 64,
            fontWeight: 800,
            lineHeight: 1.15,
            letterSpacing: -1,
            maxWidth: 1000,
          }}
        >
          {title}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 26, color: "#99f6e0" }}>
          <div style={{ width: 12, height: 12, borderRadius: 999, background: "#fbbf24" }} />
          {locale === "ar"
            ? "الدليل الكامل لمزودي الفوترة الإلكترونية المعتمدين في الإمارات"
            : "The complete UAE pre-approved e-invoicing provider directory"}
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
