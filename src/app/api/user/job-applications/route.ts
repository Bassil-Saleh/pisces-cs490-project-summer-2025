import { NextRequest, NextResponse } from "next/server";
import { bucket } from "@/lib/firebaseAdmin";

type UsedResume = {
  name: string;
  path: string;
  resumeID: string;
  jobID: string;
};

export async function GET(request: NextRequest) {
  try {
    const userID = request.nextUrl.searchParams.get("userID");

    if (!userID) {
      return NextResponse.json(
        { error: "Missing userID parameter" },
        { status: 400 }
      );
    }

    const resumeDirPath = `users/${userID}/resumes`;
    const [files] = await bucket.getFiles({ prefix: resumeDirPath });
    
    const usedResumes: UsedResume[] = await Promise.all(
      files.map(async (file) => {
        const [metadata] = await file.getMetadata();
        const customMeta = metadata.metadata || {};

        const usedResume: UsedResume = {
          name: file.name.split("/").pop() || file.name,
          resumeID: String(customMeta.resumeID || ""),
          jobID: String(customMeta.jobID || ""),
          path: file.name,
        };
        return usedResume;
      }));
  } catch (error) {
    console.error("Error retrieving used resumes: ", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}