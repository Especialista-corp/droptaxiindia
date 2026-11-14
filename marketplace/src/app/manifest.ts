import type { MetadataRoute } from "next";
import { BRAND, COLORS } from "@/lib/constants";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.manifestName,
    short_name: BRAND.name,
    description: BRAND.manifestDescription,
    start_url: "/",
    display: "standalone",
    background_color: COLORS.background,
    theme_color: COLORS.background,
    orientation: "portrait",
    icons: [
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
