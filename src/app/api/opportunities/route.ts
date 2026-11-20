import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Job & opportunity feed aggregator for the engineer's specialisations.
 * Reads ONLY free public feeds (Google News RSS + free job RSS/Atom feeds) —
 * no API keys, no scraping of closed platforms.
 */

export interface FeedItem {
  title: string;
  link: string;
  source: string;
  publishedAt: string | null;
  summary: string;
  matchedKeywords: string[];
}

interface FeedSource {
  name: string;
  url: string;
}

const SPECIALISATION_KEYWORDS: Array<{ label: string; terms: string[] }> = [
  { label: "Revit / BIM", terms: ["revit", "bim", "bim modeler", "bim coordinator"] },
  { label: "AutoCAD / MEP", terms: ["autocad", "autocad mep", "mep draftsman", "mep design", "mep engineer"] },
  { label: "تشغيل وصيانة O&M", terms: ["operation and maintenance", "o&m", "facility management", "maintenance engineer", "الصيانة", "تشغيل"] },
  { label: "السعودية / الخليج", terms: ["saudi", "riyadh", "jeddah", "khobar", "damman", "السعودية", "الرياض"] },
];

function buildFeedSources(keywords: string[]): FeedSource[] {
  // Precise, hiring-focused queries so results are actual vacancies/announcements
  // rather than every article that happens to mention "BIM".
  const hiringHints = [
    'hiring OR vacancy OR "we are hiring" OR "job opening" OR recruitment OR apply now OR "join our team"',
    "وظائف OR مطلوب OR نوظف OR توظيف OR إعلان توظيف OR نطلب",
  ];
  const skillGroups = [
    '("revit" OR "bim modeler" OR "bim coordinator" OR "bim technician")',
    '("autocad" OR "autocad mep" OR "mep draftsman" OR "mep design")',
    '("operation and maintenance" OR "o&m" OR "facility management")',
    '("mechanical draftsman" OR "electrical draftsman" OR "plumbing draftsman")',
  ];
  const regions = [
    '("saudi arabia" OR riyadh OR jeddah OR khobar OR dammam OR "eastern province")',
    "(السعودية OR الرياض OR جدة OR الخبر OR الدمام)",
  ];

  const feedDefs: Array<{ name: string; query: string; locale: string }> = [
    {
      name: "Google News — Revit/BIM توظيف (EN)",
      query: `${skillGroups[0]} ${hiringHints[0]} ${regions[0]}`,
      locale: "en-US&gl=US&ceid=US:en",
    },
    {
      name: "Google News — AutoCAD/MEP توظيف (EN)",
      query: `${skillGroups[1]} ${hiringHints[0]} ${regions[0]}`,
      locale: "en-US&gl=US&ceid=US:en",
    },
    {
      name: "Google News — O&M توظيف (EN)",
      query: `${skillGroups[2]} ${hiringHints[0]} ${regions[0]}`,
      locale: "en-US&gl=US&ceid=US:en",
    },
    {
      name: "Google News — رسامين MEP توظيف (عربي)",
      query: `${skillGroups[3]} ${hiringHints[1]} ${regions[1]}`,
      locale: "ar&gl=SA&ceid=SA:ar",
    },
    {
      name: "Google News — توظيف MEP/BIM (عربي)",
      query: `${skillGroups[0]} OR ${skillGroups[1]} ${hiringHints[1]} ${regions[1]}`,
      locale: "ar&gl=SA&ceid=SA:ar",
    },
  ];

  // Custom user keywords override the generic skill groups for tighter results.
  if (keywords.length > 0) {
    const custom = keywords.slice(0, 6).map((k) => `"${k}"`).join(" OR ");
    feedDefs.push({
      name: "Google News — كلماتك الخاصة",
      query: `(${custom}) ${hiringHints[0]} ${regions[0]}`,
      locale: "en-US&gl=US&ceid=US:en",
    });
    feedDefs.push({
      name: "Google News — كلماتك الخاصة (عربي)",
      query: `(${custom}) ${hiringHints[1]}`,
      locale: "ar&gl=SA&ceid=SA:ar",
    });
  }

  return feedDefs.map((def) => ({
    name: def.name,
    url: `https://news.google.com/rss/search?q=${encodeURIComponent(def.query)}&hl=${def.locale}`,
  }));
}

function extractTag(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? match[1].trim() : "";
}

function stripHtml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function parseFeed(xml: string, sourceName: string): Array<{ title: string; link: string; source: string; publishedAt: string | null; summary: string }> {
  const items = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
  return items
    .slice(0, 40)
    .map((item) => {
      const title = stripHtml(extractTag(item, "title"));
      let link = stripHtml(extractTag(item, "link"));
      const guid = stripHtml(extractTag(item, "guid"));
      if (!link && guid && /^https?:\/\//i.test(guid)) link = guid;
      const pubDate = stripHtml(extractTag(item, "pubDate"));
      const description = stripHtml(extractTag(item, "description")).slice(0, 320);
      const sourceTag = stripHtml(extractTag(item, "source")) || sourceName;
      return {
        title,
        link,
        source: sourceTag,
        publishedAt: pubDate ? new Date(pubDate).toISOString() : null,
        summary: description,
      };
    })
    .filter((entry) => entry.title && /^https?:\/\//i.test(entry.link));
}

function matchKeywords(text: string, explicitTerms: string[]): string[] {
  const haystack = text.toLowerCase();
  const matched = new Set<string>();
  for (const group of SPECIALISATION_KEYWORDS) {
    for (const term of group.terms) {
      if (haystack.includes(term.toLowerCase())) {
        matched.add(group.label);
        break;
      }
    }
  }
  for (const term of explicitTerms) {
    const t = term.trim().toLowerCase();
    if (t.length >= 3 && haystack.includes(t)) matched.add(term.trim());
  }
  return [...matched];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customRaw = searchParams.get("keywords") || "";
    const explicitTerms = customRaw
      .split(/[,\n،]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 12);
    const limit = Math.min(60, Math.max(5, Number(searchParams.get("limit")) || 30));

    const baseTerms = SPECIALISATION_KEYWORDS.flatMap((g) => g.terms).slice(0, 8);
    const sources = buildFeedSources(explicitTerms);

    const results = await Promise.allSettled(
      sources.map(async (source) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 9000);
        try {
          const res = await fetch(source.url, {
            signal: controller.signal,
            headers: { "User-Agent": "MiHwar-Dashboard/1.0 (+job feed reader)" },
            cache: "no-store",
          });
          if (!res.ok) throw new Error(`${res.status}`);
          const xml = await res.text();
          return parseFeed(xml, source.name);
        } finally {
          clearTimeout(timeout);
        }
      })
    );

    const all: FeedItem[] = [];
    const seen = new Set<string>();
    let sourcesOk = 0;

    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      sourcesOk += 1;
      for (const entry of result.value) {
        const key = entry.link.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        const haystack = `${entry.title} ${entry.summary}`;
        const matched = matchKeywords(haystack, explicitTerms);
        if (matched.length === 0) continue;
        all.push({ ...entry, matchedKeywords: matched });
      }
    }

    all.sort((a, b) => {
      const ta = a.publishedAt ? Date.parse(a.publishedAt) : 0;
      const tb = b.publishedAt ? Date.parse(b.publishedAt) : 0;
      return tb - ta;
    });

    return NextResponse.json({
      items: all.slice(0, limit),
      total: all.length,
      sources: sources.map((s) => s.name),
      sourcesOk,
      keywords: SPECIALISATION_KEYWORDS.map((g) => g.label),
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("GET /api/opportunities error:", error);
    return NextResponse.json({ error: "تعذر جلب الإعلانات الآن" }, { status: 502 });
  }
}
