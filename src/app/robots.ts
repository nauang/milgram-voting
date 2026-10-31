import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// robots.txt NÃO protege nada (é só um pedido a robôs educados). O /admin é protegido
// pelo login; aqui só evitamos que ele e a API apareçam em buscadores.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
