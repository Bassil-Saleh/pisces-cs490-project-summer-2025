"use client";

import { useAuth } from "@/context/authContext";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { ref, list, StorageReference } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { 
    Lightbulb, 
    Briefcase, 
    FileText, 
    CheckCircle, 
    AlertCircle,
    Loader2,
    MessageSquare,
    File,
    FileImage,
    Calendar
} from "lucide-react";

interface JobAd {
    companyName: string;
    jobTitle: string;
    jobDescription: string;
    dateSubmitted: any;
}

interface FreeFormText {
    text: string;
    label: string;
    dateSubmitted: any;
}

interface UploadedFile {
    ref: StorageReference;
    name: string;
    path: string;
}

export default function AdviceGenerationPage() {
    const { user, loading } = useAuth();
    const router = useRouter();

    const [jobAds, setJobAds] = useState<JobAd[]>([]);
    const [freeFormText, setFreeFormText] = useState<FreeFormText[]>([]);
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
    const [selectedJobAd, setSelectedJobAd] = useState<JobAd | null>(null);
    const [selectedResume, setSelectedResume] = useState<string>("");
    const [selectedResumeText, setSelectedResumeText] = useState<string>("");
    const [advice, setAdvice] = useState<string>("");
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingFiles, setIsLoadingFiles] = useState(true);
    const [isParsingResume, setIsParsingResume] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (!loading && user) {
            loadUserData();
            loadUploadedFiles();
        }
        if (!loading && !user) {
            router.push("/");
        }
    }, [user, loading, router]);

    async function loadUserData() {
        try {
            const documentRef = doc(db, "users", user!.uid);
            const document = await getDoc(documentRef);
            
            if (document.exists()) {
                const data = document.data();
                setJobAds(data?.jobAds || []);
                setFreeFormText(data?.freeFormText || []);
            }
        } catch (err) {
            console.error("Error loading user data:", err);
            setError("Failed to load user data. Please try again.");
        }
    }

    async function loadUploadedFiles() {
        if (!user) return;
        
        try {
            const listRef = ref(storage, `users/${user.uid}/uploads`);
            const result = await list(listRef, { maxResults: 50 });
            
            // Filter for resume-like files (common resume file types)
            const resumeFiles = result.items
                .filter(item => {
                    const extension = item.name.split('.').pop()?.toLowerCase();
                    return ['pdf', 'docx', 'doc', 'odt', 'txt', 'md'].includes(extension || '');
                })
                .map(item => ({
                    ref: item,
                    name: item.name,
                    path: item.fullPath
                }));
            
            setUploadedFiles(resumeFiles);
        } catch (err) {
            console.error("Error loading uploaded files:", err);
            setError("Failed to load uploaded files. Please try again.");
        } finally {
            setIsLoadingFiles(false);
        }
    }

    async function parseResumeFile(filePath: string): Promise<string> {
        const idToken = await user?.getIdToken();
        
        const response = await fetch("/api/process-upload", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                filePath: filePath,
                idToken: idToken,
            }),
        });

        if (!response.ok) {
            throw new Error(`Failed to parse resume: ${response.status}`);
        }

        const data = await response.json();
        return data.rawText;
    }

    async function handleResumeSelection(resumeId: string) {
        setSelectedResume(resumeId);
        setSelectedResumeText("");
        setError(null);

        if (resumeId.startsWith("freeform_")) {
            // Handle free-form text
            const index = parseInt(resumeId.split("_")[1]);
            const freeFormResume = freeFormText[index];
            if (freeFormResume) {
                setSelectedResumeText(freeFormResume.text);
            }
        } else if (resumeId.startsWith("uploaded_")) {
            // Handle uploaded file
            setIsParsingResume(true);
            try {
                const index = parseInt(resumeId.split("_")[1]);
                const uploadedFile = uploadedFiles[index];
                if (uploadedFile) {
                    const resumeText = await parseResumeFile(uploadedFile.path);
                    setSelectedResumeText(resumeText);
                }
            } catch (err: any) {
                console.error("Error parsing resume:", err);
                setError(`Failed to parse resume: ${err.message}`);
                setSelectedResume("");
            } finally {
                setIsParsingResume(false);
            }
        }
    }

    async function generateAdvice() {
        if (!selectedJobAd || !selectedResumeText) {
            setError("Please select both a job ad and a resume.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setSuccess(false);

        try {
            const response = await fetch("/api/jobs/advice", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    jobAd: selectedJobAd,
                    resumeText: selectedResumeText,
                    userId: user?.uid,
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            setAdvice(data.advice);
            setSuccess(true);
        } catch (err: any) {
            console.error("Error generating advice:", err);
            setError(err.message || "Failed to generate advice. Please try again.");
        } finally {
            setIsLoading(false);
        }
    }

    function getFileIcon(fileName: string) {
        const extension = fileName.split('.').pop()?.toLowerCase();
        
        switch (extension) {
            case 'pdf':
                return <FileText className="h-5 w-5 text-red-600" />;
            case 'docx':
            case 'doc':
                return <FileText className="h-5 w-5 text-blue-600" />;
            case 'odt':
                return <FileText className="h-5 w-5 text-green-600" />;
            case 'txt':
            case 'md':
                return <FileText className="h-5 w-5 text-gray-600" />;
            default:
                return <File className="h-5 w-5 text-gray-500" />;
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="text-center space-y-2">
                <div className="flex items-center justify-center gap-3">
                    <Lightbulb className="h-8 w-8 text-blue-600" />
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                        Career Advice Generator
                    </h1>
                </div>
                <p className="text-gray-600 dark:text-gray-300">
                    Get personalized advice to improve your job application
                </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                {/* Job Ad Selection */}
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden advice-card">
                    <div className="bg-gray-50 dark:bg-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-700 advice-card-header">
                        <div className="flex items-center gap-3">
                            <Briefcase className="h-5 w-5 text-blue-600" />
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Select Job Ad
                            </h2>
                        </div>
                    </div>
                    <div className="p-6">
                        {jobAds.length === 0 ? (
                            <div className="text-center py-8">
                                <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                                <p className="text-gray-500 dark:text-gray-400">
                                    No job ads found. Please upload some job descriptions first.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {jobAds.map((job, index) => (
                                    <div
                                        key={index}
                                        className={`p-4 border rounded-lg cursor-pointer transition-all advice-job-card ${
                                            selectedJobAd === job
                                                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 selected"
                                                : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                                        }`}
                                        onClick={() => setSelectedJobAd(job)}
                                    >
                                        <h3 className="font-semibold text-gray-900 dark:text-white">
                                            {job.jobTitle}
                                        </h3>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                            {job.companyName}
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                            {job.jobDescription.substring(0, 100)}...
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Resume Selection */}
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden advice-card">
                    <div className="bg-gray-50 dark:bg-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-700 advice-card-header">
                        <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-blue-600" />
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Select Resume
                            </h2>
                        </div>
                    </div>
                    <div className="p-6">
                        <div className="space-y-3">
                            {/* Loading State */}
                            {isLoadingFiles && (
                                <div className="flex items-center gap-2 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
                                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                                    <span className="text-blue-800 dark:text-blue-200">Loading your resumes...</span>
                                </div>
                            )}

                            {/* Uploaded Resume Files */}
                            {!isLoadingFiles && uploadedFiles.length > 0 && (
                                <>
                                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                        Uploaded Resume Files
                                    </h4>
                                    {uploadedFiles.map((file, index) => (
                                        <div
                                            key={index}
                                            className={`p-4 border rounded-lg cursor-pointer transition-all advice-resume-card ${
                                                selectedResume === `uploaded_${index}`
                                                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 selected"
                                                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                                            } ${isParsingResume && selectedResume === `uploaded_${index}` ? "opacity-50" : ""}`}
                                            onClick={() => !isParsingResume && handleResumeSelection(`uploaded_${index}`)}
                                        >
                                            <div className="flex items-center gap-3">
                                                {getFileIcon(file.name)}
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                                                        {file.name}
                                                    </h3>
                                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                                        Uploaded resume file
                                                    </p>
                                                </div>
                                                {isParsingResume && selectedResume === `uploaded_${index}` && (
                                                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </>
                            )}

                            {/* Free Form Resume Options */}
                            {freeFormText.length > 0 && (
                                <>
                                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 mt-4">
                                        Free-Form Text Resumes
                                    </h4>
                                    {freeFormText.map((resume, index) => (
                                        <div
                                            key={index}
                                            className={`p-4 border rounded-lg cursor-pointer transition-all advice-resume-card ${
                                                selectedResume === `freeform_${index}`
                                                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 selected"
                                                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                                            }`}
                                            onClick={() => handleResumeSelection(`freeform_${index}`)}
                                        >
                                            <div className="flex items-center gap-3">
                                                <FileText className="h-5 w-5 text-green-600" />
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-semibold text-gray-900 dark:text-white">
                                                        {resume.label}
                                                    </h3>
                                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                                        Free-form resume
                                                    </p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 truncate">
                                                        {resume.text.substring(0, 100)}...
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </>
                            )}

                            {/* No Resumes Found */}
                            {!isLoadingFiles && uploadedFiles.length === 0 && freeFormText.length === 0 && (
                                <div className="text-center py-8">
                                    <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                                    <p className="text-gray-500 dark:text-gray-400">
                                        No resumes found. Please upload some resume files or add free-form text resumes first.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Generate Advice Button */}
            <div className="flex justify-center">
                <Button
                    onClick={generateAdvice}
                    disabled={isLoading || !selectedJobAd || !selectedResumeText || isParsingResume}
                    className={`px-8 py-3 font-medium flex items-center gap-2 advice-button ${
                        isLoading
                            ? "bg-gray-500 cursor-wait text-white"
                            : "bg-blue-600 hover:bg-blue-700 text-white"
                    }`}
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Generating Advice...
                        </>
                    ) : (
                        <>
                            <MessageSquare className="h-4 w-4" />
                            Generate Career Advice
                        </>
                    )}
                </Button>
            </div>

            {/* Status Messages */}
            {error && (
                <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    <p className="text-sm text-red-800 dark:text-red-200 font-semibold">
                        {error}
                    </p>
                </div>
            )}

            {success && (
                <div className="flex items-center gap-2 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <p className="text-sm text-green-800 dark:text-green-200 font-semibold">
                        Advice generated successfully!
                    </p>
                </div>
            )}

            {/* Advice Display */}
            {advice && (
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden advice-display">
                    <div className="bg-gray-50 dark:bg-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-700 advice-display-header">
                        <div className="flex items-center gap-3">
                            <Lightbulb className="h-5 w-5 text-yellow-600" />
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Career Advice
                            </h2>
                        </div>
                    </div>
                    <div className="p-6">
                        <div className="prose prose-sm max-w-none dark:prose-invert">
                            <div className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                                {advice}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
