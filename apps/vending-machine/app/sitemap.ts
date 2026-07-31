import type { MetadataRoute } from "next";
import { serverEnv } from "@/lib/env";
import { VENDING_SERVICES } from "@/lib/services/registry";

const baseUrl = serverEnv.PUBLIC_BASE_URL ?? "https://vending-machine-seven.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/test`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/disclaimer`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
    { url: `${baseUrl}/privacy`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
    { url: `${baseUrl}/terms`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
  ];

  const serviceRoutes: MetadataRoute.Sitemap = VENDING_SERVICES.filter((s) => s.enabled).map(
    (s) => ({
      url: `${baseUrl}/pay/${s.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    }),
  );

  return [...staticRoutes, ...serviceRoutes];
}
