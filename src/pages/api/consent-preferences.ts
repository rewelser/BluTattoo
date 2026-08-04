import type {APIRoute} from "astro";
import {validateRequest} from "../../domain/analytics/utils.ts";
import {consentPreferencesSchema} from "../../domain/analytics/schema.ts";

export const prerender = false;

export const POST: APIRoute = (async ({
                                          request,
                                          cookies,
                                      }) => {
    const result = await validateRequest(request, consentPreferencesSchema);

    if (result instanceof Response) {
        return result;
    }

    const preferences = {
        necessary: true,
        ...result,
    }

    cookies.set(
        "consent-preferences",
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