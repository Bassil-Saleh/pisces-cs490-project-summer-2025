"use client";

import { Star } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/authContext";
import { useRouter } from "next/navigation";
import { doc, getDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

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

export default function TrackApplicationsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [usedResumes, setUsedResumes] = useState<UsedResume[]>([]);
  const [jobApps, setJobApps] = useState<JobApp[]>([]);
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
    </div>
  );
}