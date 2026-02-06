import { describe, expect, it } from "vitest";
import { canonicalizePath, routeSlug } from "../src/utils.js";

describe("canonicalizePath", () => {
  it("normalizes empty input", () => {
    expect(canonicalizePath("")).toBe("/");
  });

  it("strips query and hash", () => {
    expect(canonicalizePath("/dashboard/?tab=1#section")).toBe("/dashboard");
  });

  it("forces leading slash", () => {
    expect(canonicalizePath("settings")).toBe("/settings");
  });
});

describe("routeSlug", () => {
  it("uses root slug", () => {
    expect(routeSlug("/")).toBe("root");
  });

  it("includes stable hash for dynamic-like routes", () => {
    const one = routeSlug("/project/1");
    const two = routeSlug("/project/2");
    expect(one).not.toBe(two);
  });
});
