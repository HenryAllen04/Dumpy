import { describe, expect, it } from "vitest";
import { applyRouteFilters, parseSitemapRoutes } from "../src/discovery.js";

describe("parseSitemapRoutes", () => {
  it("extracts same-origin paths only", () => {
    const xml = `
      <urlset>
        <url><loc>https://preview.example.com/</loc></url>
        <url><loc>https://preview.example.com/dashboard</loc></url>
        <url><loc>https://other.example.com/private</loc></url>
      </urlset>
    `;

    expect(parseSitemapRoutes(xml, "https://preview.example.com")).toEqual([
      "/",
      "/dashboard"
    ]);
  });
});

describe("applyRouteFilters", () => {
  it("applies excludes and max route limit", () => {
    const routes = ["/", "/dashboard", "/api/health", "/settings"];
    const filtered = applyRouteFilters(routes, ["/api/*"], 2);

    expect(filtered).toEqual(["/", "/dashboard"]);
  });
});
