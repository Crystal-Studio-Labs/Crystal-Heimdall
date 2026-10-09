import React, { useEffect } from "react";

export interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string[];
  canonicalPath?: string;
  ogType?: "website" | "article";
  ogImage?: string;
  noIndex?: boolean;
  jsonLd?: Record<string, any>;
}

export default function SEO({
  title = "Crystal Heimdall // Autonomous Reliability Sentinel",
  description = "Industrial Brutalism Uptime Tracker, Telemetry Sentinel & Synthetic Monitor for Crystal Studio Labs. Continuous health checks, Sentry crash sinks, and Web Audio siren alarms.",
  keywords = [
    "Crystal Heimdall",
    "Crystal Studio Labs",
    "Uptime Kuma",
    "Uptime Tracker",
    "Status Page",
    "Synthetic Monitoring",
    "Incident Management",
    "Sentry Crash Sink",
    "PWA Status",
    "Industrial Brutalism",
    "Reliability Sentinel"
  ],
  canonicalPath = "/",
  ogType = "website",
  ogImage = "/og-image.svg",
  noIndex = false,
  jsonLd
}: SEOProps) {
  useEffect(() => {
    // 1. Document Title
    const formattedTitle = title.includes("Crystal Heimdall") 
      ? title 
      : `${title} | Crystal Heimdall`;
    document.title = formattedTitle;

    // Helper to set or create meta tag
    const setMetaTag = (attribute: "name" | "property", key: string, content: string) => {
      let element = document.querySelector(`meta[${attribute}="${key}"]`);
      if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attribute, key);
        document.head.appendChild(element);
      }
      element.setAttribute("content", content);
    };

    // Helper to set or create link tag
    const setLinkTag = (rel: string, href: string) => {
      let element = document.querySelector(`link[rel="${rel}"]`);
      if (!element) {
        element = document.createElement("link");
        element.setAttribute("rel", rel);
        document.head.appendChild(element);
      }
      element.setAttribute("href", href);
    };

    const origin = typeof window !== "undefined" ? window.location.origin : "https://status.crystalstudio.labs";
    const fullCanonicalUrl = `${origin}${canonicalPath.startsWith("/") ? canonicalPath : `/${canonicalPath}`}`;
    const fullOgImageUrl = ogImage.startsWith("http") ? ogImage : `${origin}${ogImage.startsWith("/") ? ogImage : `/${ogImage}`}`;

    // Standard SEO Meta
    setMetaTag("name", "description", description);
    setMetaTag("name", "keywords", keywords.join(", "));
    setMetaTag("name", "author", "Crystal Studio Labs");
    setMetaTag("name", "robots", noIndex ? "noindex, nofollow" : "index, follow, max-image-preview:large");

    // Canonical
    setLinkTag("canonical", fullCanonicalUrl);

    // Open Graph Metadata
    setMetaTag("property", "og:title", formattedTitle);
    setMetaTag("property", "og:description", description);
    setMetaTag("property", "og:type", ogType);
    setMetaTag("property", "og:url", fullCanonicalUrl);
    setMetaTag("property", "og:image", fullOgImageUrl);
    setMetaTag("property", "og:site_name", "Crystal Heimdall");
    setMetaTag("property", "og:locale", "en_US");

    // Twitter Card Metadata
    setMetaTag("name", "twitter:card", "summary_large_image");
    setMetaTag("name", "twitter:title", formattedTitle);
    setMetaTag("name", "twitter:description", description);
    setMetaTag("name", "twitter:image", fullOgImageUrl);
    setMetaTag("name", "twitter:site", "@CrystalStudioLabs");
    setMetaTag("name", "twitter:creator", "@CrystalStudioLabs");

    // Structured JSON-LD Data
    const defaultJsonLd = jsonLd || {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "Crystal Heimdall",
      "operatingSystem": "All",
      "applicationCategory": "DeveloperApplication",
      "description": description,
      "url": fullCanonicalUrl,
      "publisher": {
        "@type": "Organization",
        "name": "Crystal Studio Labs",
        "url": "https://github.com/Crystal-Studio-Labs"
      }
    };

    let scriptTag = document.querySelector('script[type="application/ld+json"]');
    if (!scriptTag) {
      scriptTag = document.createElement("script");
      scriptTag.setAttribute("type", "application/ld+json");
      document.head.appendChild(scriptTag);
    }
    scriptTag.textContent = JSON.stringify(defaultJsonLd);
  }, [title, description, keywords, canonicalPath, ogType, ogImage, noIndex, jsonLd]);

  return null;
}
