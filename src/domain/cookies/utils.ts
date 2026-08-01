import {z} from "zod";
import {allowedFormContentTypes} from "./defs.ts";

export async function validateRequest<S extends z.ZodType>(request: Request, schema: S) {
    const checkedContentType = checkFormContentType(request);
    if (checkedContentType) {
        return checkedContentType;
    } else {
        return await validateFormData(request, schema);
    }
}

function checkFormContentType(request: Request): Response | undefined {
    const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() ?? "";
    console.log("request: " + request.headers.get("content-type"));
    console.log("contentType: ", contentType);

    if (!allowedFormContentTypes.has(contentType)) {
        return Response.json(
            {
                saved: false,
                error: "Expected form data.",
            },
            {
                status: 415,
            },
        )
    }
    return undefined;
}

async function validateFormData<S extends z.ZodType>(request: Request, schema: S): Promise<Response | z.output<S>> {
    let formData: FormData;

    try {
        formData = await request.formData();
    } catch {
        return Response.json(
            {
                success: false,
                error: "Could not parse request body.",
            },
            {
                status: 400,
            },
        );
    }

    const rawInput = Object.fromEntries(formData);
    // const rawInput = await request.json();
    const result = schema.safeParse(rawInput);
    if (!result.success) {
        return Response.json(
            {
                success: false,
                error: "Invalid request data.",
                issues: result.error.issues,
            },
            {
                status: 400,
            },
        );
    }
    return result.data;
}