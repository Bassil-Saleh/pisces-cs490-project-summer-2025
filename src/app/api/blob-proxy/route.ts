import { NextRequest, NextResponse } from "next/server";
import { bucket } from "@/lib/firebaseAdmin";

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
        stream.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        stream.on("error", (error) => reject(error));
        stream.on("end", () => resolve(Buffer.concat(chunks)));
    });
}

export async function GET(request: NextRequest) {
  try {
    const userID = request.nextUrl.searchParams.get("userID");
    const fileName = request.nextUrl.searchParams.get("file");

    if (!userID || !fileName) {
      return NextResponse.json(
        { error: "Missing userID or file parameter" },
        { status: 400 }
      );
    }

    const filePath = `users/${userID}/resumes/${fileName}`;
    const file = bucket.file(filePath);

    const [exists] = await file.exists();
    if (!exists) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      );
    }
    
    const buffer = await streamToBuffer(file.createReadStream());
    return new NextResponse(buffer, { status: 200 });
    
  } catch (error) {
    console.error("Error retrieving used resume file: ", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}