import { createStart, createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { attachSupabaseAuth } from "./integrations/supabase/auth-attacher";
import { renderErrorPage } from "./lib/error-page";

const csrfMiddleware = createMiddleware().server(async ({ next }) => {
  const request = getRequest();
  if (request.method !== "GET" && request.method !== "HEAD") {
    const origin = request.headers.get("origin");
    const expectedOrigin = new URL(request.url).origin;
    if (!origin || new URL(origin).origin !== expectedOrigin) {
      throw new Error("Origin check failed");
    }
  }
  return next();
});

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware, errorMiddleware],
  functionMiddleware: [attachSupabaseAuth],
}));
