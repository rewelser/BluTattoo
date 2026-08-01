import type {APIRoute} from "astro";
import {validateRequest} from "../../domain/cookies/utils.ts";
import {cookiePreferencesSchema} from "../../domain/cookies/schema.ts";

export const prerender = false;

export const POST: APIRoute = (async ({
                                          request,
                                          cookies,
                                      }) => {
    console.log("requestrrr: " + request.headers.get("content-type"));
    const result = await validateRequest(request, cookiePreferencesSchema);

    if (result instanceof Response) {
        return result;
    }

    const preferences = {
        necessary: true,
        ...result,
    }
    console.log(preferences);

    cookies.set(
        "cookie-preferences",
        JSON.stringify(preferences),
        {
            path: "/",
            maxAge: 60 * 60 * 24 * 180,
            sameSite: "lax",
            secure: import.meta.env.PROD,
        }
    )

    return Response.json({
        success: true,
        preferences,
    })
}) satisfies APIRoute;