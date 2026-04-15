import type { MetadataRoute } from "next";
import { isIndexingAllowed } from "@/lib/siteIndexing";

export default function robots(): MetadataRoute.Robots {
  if (!isIndexingAllowed()) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
  };
}
