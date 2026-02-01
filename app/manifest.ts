import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Treasurer - Nonprofit Financial Management",
    short_name: "Treasurer",
    description:
      "Financial management for 501(c)(3) treasurers. Track transactions, manage accounts, and generate reports across multiple organizations.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#18181b",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
