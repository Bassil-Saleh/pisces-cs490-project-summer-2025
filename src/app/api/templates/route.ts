import { NextRequest, NextResponse } from "next/server";
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { bucket } from '@/lib/firebaseAdmin';
import { getAuth } from 'firebase-admin/auth';

type LatexTemplate = {
    templateName: string; //oneColV1, oneColV2, twoColV1, twoColV2, twoColV3
    templateID: string; //uuidv4()
    path: string;
}

export async function GET(req: NextRequest) {
    try {
        const userID = req.nextUrl.searchParams.get("userID");

        if (!userID) {
            return NextResponse.json({ error: "userID parameter is missing" }, { status: 400});
        }

        const templatePath = `users/${userID}/templates`;
        const [templateFiles] = await bucket.getFiles({ prefix: templatePath});

        const templates: LatexTemplate[] = await Promise.all(
            templateFiles.map(async (templateFile) => {
                const [metadata] = await templateFile.getMetadata();
                const customMeta = metadata.metadata || {};

                const template: LatexTemplate = {
                    templateName: templateFile.name.split("/").pop() || templateFile.name,
                    templateID: String(customMeta.templateID || ""),
                    path: templateFile.name,
                };
                return template;
            }));
        return NextResponse.json(templates, { status: 200 });
    } catch (error) {
        console.error("Error retrieving a template: ", error);
        return NextResponse.json({ error: "Internal server error"}, { status: 500});
    }
}