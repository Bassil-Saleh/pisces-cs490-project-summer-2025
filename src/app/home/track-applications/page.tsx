"use client";

import { 
  Star, 
  Briefcase,
  AlertCircle,
  FileText,
  Eye,
  Download } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/authContext";
import { useRouter } from "next/navigation";
import { doc, getDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { User } from "firebase/auth";

type UsedResume = {
  name: string;
  path: string;
  resumeID: string;
  jobID: string;
};

type JobApp = {
  companyName: string;
  jobTitle: string;
  jobDescription: string;
  dateSubmitted: Timestamp;
  jobID: string;
  applied: boolean;
};

async function fetchBlobProxy(userID: string, fileName: string, user: User) {
  try {
    if (!user) throw new Error("User not authenticated");

    const token = await user.getIdToken(); // Get Firebase ID token

    const response = await fetch(
      `/api/blob-proxy?userID=${encodeURIComponent(userID)}&file=${encodeURIComponent(fileName)}`,
      { headers: { Authorization: `Bearer ${token}`} });
    
    if (!response.ok) throw new Error(`Proxy fetch failed: ${response.status}`);

    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error("Error getting download URL for used resume: ", error);
    return "#";
  }
}

type DownloadResumeButtonProps = {
  fileName: string;
  user: User | null;
}

function DownloadResumeButton({fileName, user}: DownloadResumeButtonProps) {
  const [fileURL, setFileURL] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    setFileURL(null);
    setError(null);
    (async () => {
      try {
        const url = await fetchBlobProxy(user.uid, fileName, user);
        if (url === null) throw new Error("Unable to download file");
        if (mounted) setFileURL(url);
      } catch (error) {
        if (mounted) {
          console.error("Error setting download URL: ", error);
          setError("Failed to load download link.");
        }
      }
    })();
    return () => {
      mounted = false;
      if (fileURL) URL.revokeObjectURL(fileURL);
    }
  }, [user, fileName]);

  if (error) return (
    <Button disabled>
      <AlertCircle className="h-4 w-4" />
      Error loading file
    </Button>
  );

  if (fileURL) return (
    <Button
      disabled={!fileURL}
      onClick={() => {
        if (fileURL) {
          const a = document.createElement('a');
          a.href = fileURL;
          a.download = fileName;
          a.click();
        }
      }}
      className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
    >
      <Download className="h-4 w-4" />
      Download
    </Button>
  );

  // if (fileURL) return (
  //   <Button
  //     disabled={!fileURL}
  //     className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
  //   >
  //     <Download className="h-4 w-4" />
  //     <a
  //       href={fileURL}
  //       download={fileName}
  //     >
  //       Download
  //     </a>
  //   </Button>
  // );

  return (
    <Button>
      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
      Loading...
    </Button>
  );
}

export default function TrackApplicationsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [usedResumes, setUsedResumes] = useState<UsedResume[]>([]);
  const [jobApps, setJobApps] = useState<JobApp[]>([]);
  
  const [selectedJob, setSelectedJob] = useState<JobApp | null>(null);
  const [selectedResume, setSelectedResume] = useState<UsedResume | null>(null);

  const [loadingResumes, setLoadingResumes] = useState(false);
  const [loadingApps, setLoadingApps] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) {
      fetchUsedResumes(user.uid);
      fetchJobApps();
    }
    if (!loading && !user) {
      router.push("/");
    }
  }, [user, loading, router]);

  function formatDateTime(isoString: string): string {
    // console.log(isoString);
    const date = new Date(isoString);

    return new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    }).format(date);
  }

  function submissionDate(dateSubmitted: Timestamp) {
    const date = formatDateTime(dateSubmitted.toDate().toISOString());
    return date;
  }

  function handleJobClick(job: JobApp) {
    if (!user) return;
    try {
      setSelectedJob(job);
      // Retrieve the resume associated with the job which the user clicked on
      const resumes = usedResumes.filter((resume) => resume.jobID === job.jobID );
      if (!resumes) {
        throw new Error(`For some strange reason, the job application ${job.jobTitle} has no resume associated with it...`);
      }
      setSelectedResume(resumes[0]);
    } catch (error) {
      console.log(`Error occured while clicking job: ${(error as Error).message || String(error)}`);
      setError(`Error occured while clicking job: ${(error as Error).message || String(error)}`);
    }
  }

  async function fetchJobApps() {
    if (!user) return;
    try {
      setLoadingApps(true);
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists() && Array.isArray(userSnap.data().jobAds)) {
        const jobs: JobApp[] = userSnap.data().jobAds;
        // console.log(jobs);
        const appliedJobs = jobs.filter((ad) => ad.applied);
        // console.log(appliedJobs);
        setJobApps(appliedJobs);
      }
    } catch (error) {
      console.log(`Error occured while fetching job applications: ${(error as Error).message || String(error)}`);
      setError(`Error occured while fetching resumes: ${(error as Error).message || String(error)}`);
    } finally {
      setLoadingApps(false);
    }
  }

  async function fetchUsedResumes(userID: string) {
    if (!user) return;
    try {
      setLoadingResumes(true);
      const response = await fetch(`/api/user/job-applications?userID=${encodeURIComponent(userID)}`);
      if (!response.ok) throw new Error(`Resume fetching failed: ${response.status}`);
      const data: UsedResume[] = await response.json();
      console.log(data);
      setUsedResumes(data);
    } catch (error) {
      console.log(`Error occured while fetching resumes: ${(error as Error).message || String(error)}`);
      setError(`Error occured while fetching resumes: ${(error as Error).message || String(error)}`);
    } finally {
      setLoadingResumes(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-3">
          <Star className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Track Your Job Applications
          </h1>
        </div>
        <p className="text-gray-600 dark:text-gray-300">
          Review job ads you've applied to and the resumes you used for them
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Job Application Selection */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden advice-card">
          <div className="bg-gray-50 dark:bg-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-700 advice-card-header">
            <div className="flex items-center gap-3">
              <Briefcase className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Select Job
              </h2>
            </div>
          </div>
          <div className="p-6">
            {jobApps.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">
                  No job applications found. Try picking a job ad you've uploaded, generate a resume for it, then click "I applied with this resume".
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {jobApps.map((job, index) => (
                  <div
                    key={index}
                    className={`p-4 border rounded-lg cursor-pointer transition-all advice-job-card ${
                      selectedJob === job
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 selected"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                    }`}
                    onClick={() => handleJobClick(job)}
                  >
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {job.jobTitle}
                    </h3>
                    <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                      {job.companyName}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {`Submitted on: ${submissionDate(job.dateSubmitted)}`}
                    </p>
                    {(selectedJob === job) && (
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 whitespace-pre-wrap overflow-auto max-h-64">
                        {job.jobDescription}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        {/* Resume View */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden advice-card">
          <div className="bg-gray-50 dark:bg-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-700 advice-card-header">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Resume Used
              </h2>
            </div>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {/* No job selected */}
              {!selectedJob && (
                <div className="text-center py-8">
                  <Eye className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">
                    Select a job you've applied to, then you'll see info about the resume you used to apply for it.
                  </p>
                </div>
              )}
              {/* Selected a job */}
              {selectedJob && selectedResume && (
                <div>
                  <div className="p-4 border rounded-lg cursor-pointer transition-all advice-job-card">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      File Name:
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {selectedResume.name}
                    </p>
                    {/* <h3 className="font-semibold text-gray-900 dark:text-white">
                      Date Submitted:
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {submissionDate(selectedJob.dateSubmitted)}
                    </p> */}
                  </div>
                  <DownloadResumeButton fileName={selectedResume.name} user={user} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}