import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/register"],
        disallow: ["/organizations/", "/settings", "/api/"],
      },
    ],
    sitemap: "https://www.donthetreasurer.com/sitemap.xml",
  };
}
