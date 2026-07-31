import type { MetadataRoute } from "next";
import { serverEnv } from "@/lib/env";

const baseUrl = serverEnv.PUBLIC_BASE_URL ?? "https://vending-machine-seven.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/admin/", "/pay/"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
