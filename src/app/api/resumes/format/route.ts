import { NextRequest, NextResponse } from "next/server";
import latex from 'node-latex';
import { Readable } from 'stream';

interface LatexTemplate {
    templateName: string;
    templateID: string;
    templateText: string;
    userID: string;
}

export async function POST(req: NextRequest) {
    try {
        //receive text from Gemini
        const body : LatexTemplate = await req.json();
        console.log("Received LaTeX:", body.templateText);

        //verify info presence
        if (!body.templateID || !body.templateText || !body.userID || !body.templateName) {
            return NextResponse.json({ error: "templateID, templateText, templateName, or userID field is missing" }, { status: 400 });
        }

        //send to npm package for rendering
        const input = Readable.from([body.templateText]);
        const pdfStream = latex(input);

        //return generated PDF
        const chunks: Buffer[] = [];

        return await new Promise((resolve, reject) => {
            pdfStream.on('data', (chunk) => {
                chunks.push(chunk);
            });

            pdfStream.on('end', () => {
                const pdfBuffer = Buffer.concat(chunks);
                const response = new NextResponse(pdfBuffer, {
                status: 200,
                headers: {
                    'Content-Type': 'application/pdf',
                },
                });
                resolve(response);
            });

            pdfStream.on('error', (err) => {
                console.error('LaTeX compilation error:', err);
                reject(NextResponse.json({ error: 'LaTeX compilation failed' }, { status: 500 }));
            });
        });
    } catch (error) {
        console.error('Processing error: ', error);
        return NextResponse.json({ error: 'Processing failed'}, { status: 500 });
    }
}