"use client";

import { useAuth } from "@/context/authContext";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Timestamp } from "firebase/firestore";
import { 
  getResumeAIResponseJSON, 
  generateResumeAIPromptJSON, 
  getPlaintextResumeAIResponseText, 
  generateResumeAIPromptPreambleText,
  getLaTeXResumeAIResponseText,
  allTemplates, //dictionary with all the templates
  oneColV1, //default template
  oneColV2, //default template
  twoColV1, //default template
  twoColV2, //default template
  twoColV3, //default template
  generateAIResumeJSONPrompt,
  generateAIResumeJSON,
} from "@/components/ai/aiPrompt";
import { v4 as uuidv4 } from "uuid";
import { Button } from "@/components/ui/button";
import { 
  Briefcase, 
  Building, 
  Calendar, 
  Download, 
  Edit, 
  Trash2, 
  Eye, 
  FileText,
  Code,
  Save,
  X,
  AlertCircle,
  CheckCircle,
  Clock,
  Wand2,
  Check,
} from "lucide-react";
import { User } from "firebase/auth";
import { ref, uploadBytes } from "firebase/storage";
import { storage } from "@/lib/firebase";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Carousel, 
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Card, CardContent } from "@/components/ui/card";

type generatedResume = {
  fullName: string;
  contact: {
    phone: string[];
    email: string[];
    location: string;
  }
  summary: string;
  workExperience: {
    jobTitle: string;
    company: string;
    startDate: string;
    endDate: string;
    jobSummary: string;
    responsibilities: string[];
  }[];
  education: {
    degree: string;
    institution: string;
    startDate: string;
    endDate: string;
    gpa: string;
  }[];
  skills: string[];
};

type JobAd = {
  companyName: string;
  jobTitle: string;
  jobDescription: string;
  dateSubmitted: Timestamp;
  jobID: string;
  applied: boolean;
};

type DownloadResumeButtonProps = {
  text: string;
  fileName: string;
};

type DownloadPDFResumeButtonProps = {
  file: Blob;
  fileName: string;
};

//for text resumes
function DownloadTextResumeButton({text, fileName}: DownloadResumeButtonProps) {
  function handleDownload() {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const textLink = document.createElement("a");
    textLink.href = url;
    textLink.download = fileName || "resume.txt";
    document.body.appendChild(textLink);
    textLink.click();
    document.body.removeChild(textLink);
    URL.revokeObjectURL(url);
  }
  
  return (
    <Button
      onClick={handleDownload}
      className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
    >
      <Download className="h-4 w-4" />
      Download Text Resume
    </Button>
  );
}

//for pdf resumes
function DownloadPDFResumeButton({file, fileName}: DownloadPDFResumeButtonProps) {
  function handleDownload() {
    const url = URL.createObjectURL(file);
    const pdfLink = document.createElement("a");
    pdfLink.href = url;
    pdfLink.download = fileName || "resume.pdf";
    document.body.appendChild(pdfLink);
    pdfLink.click();
    document.body.removeChild(pdfLink);
    URL.revokeObjectURL(url);
  }

  return (
    <Button
      onClick={handleDownload}
      className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
    >
      <Download className="h-4 w-4" />
      Download PDF Resume
    </Button>
  );
}

export default function ViewJobAdsPage() {
  const { user, loading } = useAuth();
  const [jobAds, setJobAds] = useState<JobAd[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  // const [editIndex, setEditIndex] = useState<number | null>(null);

  // Since the job ads are being filtered based on whether the user already applied to them, 
  // any edits to visible job ads should not be used with editIndex,
  // otherwise bugs will occur whenever the user attemps to edit or delete entries. Some examples:
  // 1. Overwriting a job marked as "applied"
  // 2. Instead of overwriting a pre-existing job ad (which the user hasn't applied to yet) with changes, 
  // an edited version of the job ad gets appended to the array so now there are two instances of the job ad in question.
  const [editJobID, setEditJobID] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<JobAd>>({});
  const [refresh, setRefresh] = useState(false);

  const [generatingText, setGeneratingText] = useState(false); // Track whether plain text resume is being generated
  const [generatingJSON, setGeneratingJSON] = useState(false); // Track whether JSON resume is being generated
  const [applying, setApplying] = useState(false); // Track whether job application is being recorded

  const [chosenTemplate, setChosenTemplate] = useState<string>("oneColV1") // Determines which template is being used; oneColV1, oneColV2, twoColV1, twoColV2, twoColV3
  const [tempID, setTempID] = useState<string>(" "); // Set the TemplateID

  const [status, setStatus] = useState<string | null>(null); // Track status message related to resume generation
  const [newResume, setNewResume] = useState<string | null>(null); // Track what is displayed to the user

  const [newResumeFile, setNewResumeFile] = useState<Blob>(new Blob()); // Tracks the resume file saved to cloud storage if the user indicates they applied to a job with it; changed to only Blob (with blank state being "new Blob()" so DownloadPDFResumeButton could accept the file param)
  const [resumeFormat, setResumeFormat] = useState<"text" | "json" | "pdf" | null>(null);  

  // We want the user to only be able to view/edit/delete job ads that aren't marked as applied,
  // and when writing changes to the database, we don't want to affect job ads that were already marked as applied.
  const visibleJobAds = jobAds.filter((ad) => !ad.applied);

  useEffect(() => {
    if (!loading && user) {
      (async () => {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && Array.isArray(userSnap.data().jobAds)) {
          setJobAds(userSnap.data().jobAds);
        }
      })();
    }
  }, [user, loading, refresh]);

  function sanitizeFileName(name: string): string {
    // Remove or replace characters that are invalid in most filesystems
    return name.replace(/[<>:"/\\|?*]/g, "").trim() || "resume";
  }

  const handleGenerateText = async (idx: number) => {
    if (!user) return;
    if (generatingText || generatingJSON || generatingPDF) return; // Concurrency lock
    setResumeFormat("text");
    try {
      setGeneratingJSON(false);
      setGeneratingPDF(false);
      setGeneratingText(true);
      setTempID(" ");
      setNewResume(null); // Clear any previous result
      setNewResumeFile(new Blob()); // Clear any previous result
      setStatus(null); // Clear any previous status message

      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists() && userSnap.data().resumeFields) {
        const resumeInfo = JSON.stringify(userSnap.data().resumeFields);
        const jobAdText = jobAds[idx].jobDescription;

        const result = await generateAIResumeJSON(generateAIResumeJSONPrompt, resumeInfo, jobAdText);
        if (!result) throw new Error("AI returned empty response while generating JSON resume");
        console.log(result);

        // The AI doesn't need to know about the jobID or resumeID when generating an unstructured text resume.
        // The AI also doesn't need to know whether or not the user applied with this resume.
        const textFinalResult = await getPlaintextResumeAIResponseText(generateResumeAIPromptPreambleText, result); // generate text resume

        const textBlob = new Blob([textFinalResult], { type: "text/plain" });

        setNewResume(textFinalResult);
        setNewResumeFile(textBlob);
        setStatus("Resume generated!");
        setTimeout(() => setStatus(null), 3000);
      }
    } catch (error) {
      setStatus(`Error occurred while generating resume: ${(error as Error).message || String(error)}`);
      setNewResume(null);
    } finally {
      setGeneratingText(false);
    }
  };

  const handleGeneratePDF = async (idx: number) => {
    if (!user) return;
    if (generatingText || generatingJSON || generatingPDF) return; // Concurrency lock
    setResumeFormat("pdf");
    try {
      setGeneratingJSON(false);
      setGeneratingPDF(true);
      setGeneratingText(false);
      setTempID(" ");
      setNewResume(null); // Clear any previous result
      setNewResumeFile(new Blob()); // Clear any previous result
      setStatus(null); // Clear any previous status message

      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists() && userSnap.data().resumeFields) {
        const resumeInfo = JSON.stringify(userSnap.data().resumeFields);
        const jobAdText = jobAds[idx].jobDescription;
        setTempID(uuidv4());

        const result = await generateAIResumeJSON(generateAIResumeJSONPrompt, resumeInfo, jobAdText);
        if (!result) throw new Error("AI returned empty response while generating JSON resume");
        console.log(result);

        // The AI needs to know the chosen template
        
        let thirdParam : string;
        if (chosenTemplate === "oneColV1") {
          thirdParam = oneColV1;
        } else if (chosenTemplate === "oneColV2") {
          thirdParam = oneColV2;
        } else if (chosenTemplate === "twoColV1") {
          thirdParam = twoColV1;
        } else if (chosenTemplate === "twoColV2") {
          thirdParam = twoColV2;          
        } else if (chosenTemplate === "twoColV3") {
          thirdParam = twoColV3;
        } else { //default, it can never hit this condition but it is here to prevent error TS2454
          thirdParam = oneColV1;
        }

        // The AI doesn't need to know about the jobID or resumeID when generating an unstructured text resume.
        // The AI also doesn't need to know whether or not the user applied with this resume.
        
        // POST request to get PDF
        const latexFinalResult = await getLaTeXResumeAIResponseText(generateResumeAIPromptPreambleText, result, thirdParam); //generate LaTeX resume
        console.log("Generated LaTeX:", latexFinalResult);
        const response = await fetch("/api/resumes/format", {
          method: "POST",
          headers: {"Content-Type": "application/json", },
          body: JSON.stringify({
            templateName: chosenTemplate,
            templateText: latexFinalResult,
            userID: user.uid,
            templateID: tempID,
          }),
        });

        if (!response.ok) throw new Error("Failed to generate PDF");

        const pdfBlob = await response.blob();

        setNewResume("PDF is ready for download"); //placeholder so that condition in AI Resume Generation will trigger !== NULL and work
        setNewResumeFile(pdfBlob);
        setStatus("Resume generated!");
        setTimeout(() => setStatus(null), 3000);
      }
    } catch (error) {
      setStatus(`Error occurred while generating resume: ${(error as Error).message || String(error)}`);
      setNewResume(null);
    } finally {
      setGeneratingPDF(false);
    }
  };

  const handleGenerateJSON = async (idx: number) => {
    if (!user) return;
    if (generatingText || generatingJSON || generatingPDF) return; // Concurrency lock
    setResumeFormat("json");
    try {
      setGeneratingText(false);
      setGeneratingPDF(false);
      setGeneratingJSON(true);
      setTempID(" ");
      setNewResume(null); // Clear any previous result
      setNewResumeFile(new Blob()); // Clear any previous result
      setStatus(null); // Clear any previous status message

      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists() && userSnap.data().resumeFields) {
        const resumeInfo = JSON.stringify(userSnap.data().resumeFields);
        const jobAdText = jobAds[idx].jobDescription;

        const result = await generateAIResumeJSON(generateAIResumeJSONPrompt, resumeInfo, jobAdText);
        if (!result) throw new Error("AI returned empty response while generating resume");

        const {fullName, contact, summary, workExperience, education, skills} = JSON.parse(result);
        const newJSONResume: generatedResume = {
          fullName: fullName,
          contact: contact,
          summary: summary,
          workExperience: workExperience,
          education: education,
          skills: skills,
        };
        console.log(newJSONResume);

        const resumeBlob = new Blob([JSON.stringify(newJSONResume, null, 2)], { type: "application/json" });

        setNewResume(JSON.stringify(newJSONResume, null, 2));
        setNewResumeFile(resumeBlob);
        setStatus("Resume generated!");
        setTimeout(() => setStatus(null), 3000);
      }
    } catch (error) {
      setStatus(`Error occurred while generating resume: ${(error as Error).message || String(error)}`);
      setNewResume(null);
    } finally {
      setGeneratingJSON(false);
    }
  };

  const handleDelete = async (idx: number) => {
    if (!user) return;
    const selectedAd = visibleJobAds[idx];
    const newAds = jobAds.filter((ad) => ad.jobID !== selectedAd.jobID);
    await updateDoc(doc(db, "users", user.uid), { jobAds: newAds });
    setSelectedIndex(null);
    setRefresh((r) => !r);
  };

  const handleEdit = (idx: number) => {
    const selectedAd = visibleJobAds[idx];
    setEditJobID(selectedAd.jobID);
    setEditData({ ...selectedAd });
    // setEditIndex(idx);
    // setEditData({ ...visibleJobAds[idx] });
  };

  const handleEditChange = (field: keyof JobAd, value: string) => {
    setEditData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!editJobID || !user) return;
    const fullIndex = jobAds.findIndex((ad) => ad.jobID === editJobID);
    if (fullIndex === -1) return;

    const updatedAds = [...jobAds];
    updatedAds[fullIndex] = {
      ...updatedAds[fullIndex],
      ...editData,
      dateSubmitted: Timestamp.now(),
    };

    await updateDoc(doc(db, "users", user.uid), { jobAds: updatedAds });
    setEditJobID(null);
    setRefresh((r) => !r);
    // if (editIndex === null || !user) return;
    // const selectedAd = visibleJobAds[editIndex];
    // const fullIndex = jobAds.findIndex((ad) => ad.jobID === selectedAd.jobID);
    // if (fullIndex === -1) return;

    // const updatedAds = [...jobAds];
    // updatedAds[editIndex] = {
    //   ...updatedAds[editIndex],
    //   ...editData,
    //   dateSubmitted: Timestamp.now(),
    // };

    // await updateDoc(doc(db, "users", user.uid), { jobAds: updatedAds });
    // setEditIndex(null);
    // setRefresh((r) => !r);
  };

  const handleApply = async () => {
    if (selectedIndex === null || !user || newResumeFile === new Blob()) return;
    const selectedAd = visibleJobAds[selectedIndex];
    const fullIndex = jobAds.findIndex((ad) => ad.jobID === selectedAd.jobID);
    if (fullIndex === -1) throw new Error("Job ad not found.");

    try {
      setApplying(true);
      // Mark the job ad as applied
      const updatedAds = [...jobAds];
      updatedAds[fullIndex] = {
        ...updatedAds[fullIndex],
        applied: true,
        dateSubmitted: Timestamp.now(),
      };

      // Record the job ad as applied in the database
      await updateDoc(doc(db, "users", user.uid), { jobAds: updatedAds });
      console.log("Job ad marked as 'applied'.");

      // Save the generated resume to the database
      let extension : string;
      if (resumeFormat === "json") {
        extension = "json";
      } else if (resumeFormat === "pdf") {
        extension = "pdf";
      } else {
        extension = "txt";
      }
      const resumeFilepath = `users/${user.uid}/resumes/${selectedAd.jobID}.${extension}`;
      const resumeFileRef = ref(storage, resumeFilepath);
      const metadata = {
        customMetadata: {
          "resumeID": uuidv4(),
          "jobID": selectedAd.jobID,
          "templateID": tempID,
        }
      };

      await uploadBytes(resumeFileRef, newResumeFile, metadata);
      // uploadBytes(resumeFileRef, newResumeFile, metadata).then(() => {
      //   console.log("Resume saved to cloud storage.");
      // }).catch((error) => {
      //   console.error("Error marking job as applied: ", error);
      //   setStatus(`Error occurred while recording job application: ${(error as Error).message || String(error)}`);
      // });
      console.log("Resume saved to database.");

      setStatus("Job marked as \"applied\"!");
      setTimeout(() => setStatus(null), 3000);

      setSelectedIndex(null);
      setResumeFormat(null);
      setNewResume(null);
      setNewResumeFile(new Blob());

      setRefresh((r) => !r);
    } catch (error) {
      console.error("Error marking job as applied: ", error);
      setStatus(`Error marking job as applied: ${(error as Error).message || String(error)}`);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-3">
          <Briefcase className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Job Advertisements
          </h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          View and manage your saved job ads, generate tailored resumes
        </p>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Job List Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden">
            <div className="bg-gray-50 dark:bg-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <Eye className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Saved Job Ads ({visibleJobAds.length})
                </h2>
              </div>
            </div>
            
            <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
              {visibleJobAds.length === 0 ? (
                <div className="text-center py-8">
                  <Briefcase className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">No job ads found</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500">Upload a job ad to get started</p>
                </div>
              ) : (
                visibleJobAds.map((ad, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg cursor-pointer transition-all duration-200 border ${
                      selectedIndex === idx 
                        ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700" 
                        : "hover:bg-gray-50 dark:hover:bg-gray-800 border-transparent"
                    }`}
                    onClick={() => {
                      if (selectedIndex !== idx) {
                        setNewResume(null);
                        setResumeFormat(null);
                      }
                      setSelectedIndex(idx);
                    }}
                  >
                    <div className="font-semibold text-gray-900 dark:text-white truncate">
                      {ad.jobTitle}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mt-1">
                      <Building className="h-3 w-3" />
                      <span className="truncate">{ad.companyName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-500 mt-1">
                      <Calendar className="h-3 w-3" />
                      <span>{ad.dateSubmitted?.toDate?.().toLocaleDateString?.() || ""}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="lg:col-span-2">
          {selectedIndex === null ? (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm p-12 text-center">
              <Eye className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Select a Job Ad
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Choose a job advertisement from the list to view details and generate resumes
              </p>
              {/* Status Messages after marking resume as applied */}
              {status && (
                <div className={`flex items-center gap-2 p-3 rounded-lg ${
                  status.includes("Error") 
                    ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700"
                    : "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700"
                }`}>
                  {status.includes("Error") ? (
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  )}
                  <span className={status.includes("Error") 
                    ? "text-red-800 dark:text-red-200" 
                    : "text-green-800 dark:text-green-200"
                  }>
                    {status}
                  </span>
                </div>
              )}
            </div>
          ) : (editJobID === visibleJobAds[selectedIndex]?.jobID) ? (
            /* Edit Mode */
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden">
              <div className="bg-gray-50 dark:bg-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <Edit className="h-5 w-5 text-blue-600" />
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Edit Job Advertisement
                  </h2>
                </div>
              </div>
              
              <div className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Job Title
                  </label>
                  <input
                    type="text"
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    value={editData.jobTitle || ""}
                    onChange={(e) => handleEditChange("jobTitle", e.target.value)}
                    placeholder="Enter job title"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Company Name
                  </label>
                  <input
                    type="text"
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    value={editData.companyName || ""}
                    onChange={(e) => handleEditChange("companyName", e.target.value)}
                    placeholder="Enter company name"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Job Description
                  </label>
                  <textarea
                    rows={8}
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
                    value={editData.jobDescription || ""}
                    onChange={(e) => handleEditChange("jobDescription", e.target.value)}
                    placeholder="Enter job description"
                  />
                </div>
                
                <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <Button
                    onClick={handleSave}
                    className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
                  >
                    <Save className="h-4 w-4" />
                    Save Changes
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setEditJobID(null)}
                    className="flex items-center gap-2"
                  >
                    <X className="h-4 w-4" />
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            /* View Mode */
            <div className="space-y-6">
              {/* Job Details Card */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden">
                <div className="bg-gray-50 dark:bg-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Briefcase className="h-5 w-5 text-blue-600" />
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Job Details
                      </h2>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(selectedIndex)}
                        className="flex items-center gap-2"
                      >
                        <Edit className="h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(selectedIndex)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 dark:text-red-400 flex items-center gap-2"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
                
                <div className="p-6 space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Job Title</label>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {visibleJobAds[selectedIndex]?.jobTitle}
                    </p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Company</label>
                    <p className="text-lg text-gray-900 dark:text-white">
                      {visibleJobAds[selectedIndex]?.companyName}
                    </p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Date Uploaded</label>
                    <p className="text-gray-900 dark:text-white">
                      {visibleJobAds[selectedIndex]?.dateSubmitted?.toDate?.().toLocaleString?.() || ""}
                    </p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 block">Description</label>
                    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                      <p className="whitespace-pre-line overflow-auto max-h-64 text-gray-900 dark:text-white leading-relaxed">
                        {visibleJobAds[selectedIndex]?.jobDescription}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Resume Generation Card */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden">
                <div className="bg-gray-50 dark:bg-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-3">
                    <Wand2 className="h-5 w-5 text-blue-600" />
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                      AI Resume Generation
                    </h2>
                  </div>
                </div>
                
                <div className="p-6 space-y-4">
                  <p className="text-gray-600 dark:text-gray-400">
                    Generate a tailored resume for this job advertisement using AI
                  </p>
                  
                  <div className="flex gap-3">
                    {resumeFormat === "pdf" && (
                      <Dialog>
                        <form>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              disabled={generatingText || generatingJSON || generatingPDF || !resumeFormat}
                            >
                              Choose a Template
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="lg:max-w-fit">
                            <DialogTitle>Choose a Template: </DialogTitle>
                            <Carousel className="w-full max-w-xl">
                              <CarouselContent>
                                <CarouselItem className="flex justify-center p-4">
                                  <div className="flex flex-col items-center gap-4 h-full w-full max-w-lg">
                                    <Card className="flex flex-col w-full h-full shadow-lg rounded-lg overflow-hidden">
                                      <CardContent className="relative flex aspect-square justify-center max-w-lg w-full">
                                        <object data="/1Col_Template_v1_output.pdf" className="absolute inset-0 w-full h-full" type="application/pdf">
                                          <p>Your browser doesn't support PDFs sorry :(</p>
                                        </object>
                                        <p className="absolute top-0 left-0 right-0 p-3 bg-secondary text-white text-sm md:text-base text-center z-10 font-semibold rounded">{allTemplates.oneColV1}</p>
                                      </CardContent>
                                    </Card>
                                    <DialogTrigger asChild>
                                        <Button
                                          disabled={generatingText || generatingJSON || generatingPDF || !resumeFormat}
                                          onClick={() => {
                                            setChosenTemplate("oneColV1");
                                          }}
                                        >
                                          Choose me!
                                        </Button>    
                                    </DialogTrigger>
                                  </div>
                                </CarouselItem>
                                <CarouselItem className="flex justify-center p-4">
                                  <div className="flex flex-col items-center gap-4 h-full w-full max-w-lg">
                                    <Card className="flex flex-col w-full h-full shadow-lg rounded-lg overflow-hidden">
                                      <CardContent className="relative flex aspect-square justify-center max-w-lg w-full">
                                        <object data="/1Col_Template_v2_output.pdf" className="absolute inset-0 w-full h-full" type="application/pdf">
                                          <p>Your browser doesn't support PDFs sorry :(</p>
                                        </object>
                                        <p className="absolute top-0 left-0 right-0 p-3 bg-secondary text-white text-sm md:text-base text-center z-10 font-semibold rounded">{allTemplates.oneColV2}</p>
                                      </CardContent>
                                    </Card>
                                    <DialogTrigger asChild>
                                        <Button
                                          disabled={generatingText || generatingJSON || generatingPDF || !resumeFormat}
                                          onClick={() => {
                                            setChosenTemplate("oneColV2");
                                          }}
                                        >
                                          Choose me!
                                        </Button>    
                                    </DialogTrigger>
                                  </div>
                                </CarouselItem>
                                <CarouselItem className="flex justify-center p-4">
                                  <div className="flex flex-col items-center gap-4 h-full w-full max-w-lg">
                                    <Card className="flex flex-col w-full h-full shadow-lg rounded-lg overflow-hidden">
                                      <CardContent className="relative flex aspect-square justify-center max-w-lg w-full">
                                        <object data="/2Col_Template_v1_output.pdf" className="absolute inset-0 w-full h-full" type="application/pdf">
                                          <p>Your browser doesn't support PDFs sorry :(</p>
                                        </object>
                                        <p className="absolute top-0 left-0 right-0 p-3 bg-secondary text-white text-sm md:text-base text-center z-10 font-semibold rounded">{allTemplates.twoColV1}</p>
                                      </CardContent>
                                    </Card>
                                    <DialogTrigger asChild>
                                        <Button
                                          disabled={generatingText || generatingJSON || generatingPDF || !resumeFormat}
                                          onClick={() => {
                                            setChosenTemplate("twoColV1");
                                          }}
                                        >
                                          Choose me!
                                        </Button>    
                                    </DialogTrigger>
                                  </div>
                                </CarouselItem>
                                <CarouselItem className="flex justify-center p-4">
                                  <div className="flex flex-col items-center gap-4 h-full w-full max-w-lg">
                                    <Card className="flex flex-col w-full h-full shadow-lg rounded-lg overflow-hidden">
                                      <CardContent className="relative flex aspect-square justify-center max-w-lg w-full">
                                        <object data="/2Col_Template_v2_output.pdf" className="absolute inset-0 w-full h-full" type="application/pdf">
                                          <p>Your browser doesn't support PDFs sorry :(</p>
                                        </object>
                                        <p className="absolute top-0 left-0 right-0 p-3 bg-secondary text-white text-sm md:text-base text-center z-10 font-semibold rounded">{allTemplates.twoColV2}</p>
                                      </CardContent>
                                    </Card>
                                    <DialogTrigger asChild>
                                        <Button
                                          disabled={generatingText || generatingJSON || generatingPDF || !resumeFormat}
                                          onClick={() => {
                                            setChosenTemplate("twoColV2");
                                          }}
                                        >
                                          Choose me!
                                        </Button>    
                                    </DialogTrigger>
                                  </div>
                                </CarouselItem>
                                <CarouselItem className="flex justify-center p-4">
                                  <div className="flex flex-col items-center gap-4 h-full w-full max-w-lg">
                                    <Card className="flex flex-col w-full h-full shadow-lg rounded-lg overflow-hidden">
                                      <CardContent className="relative flex aspect-square justify-center max-w-lg w-full">
                                        <object data="/2Col_Template_v3_output.pdf" className="absolute inset-0 w-full h-full" type="application/pdf">
                                          <p>Your browser doesn't support PDFs sorry :(</p>
                                        </object>
                                        <p className="absolute top-0 left-0 right-0 p-3 bg-secondary text-white text-sm md:text-base text-center z-10 font-semibold rounded">{allTemplates.twoColV3}</p>
                                      </CardContent>
                                    </Card>
                                    <DialogTrigger asChild>
                                        <Button
                                          disabled={generatingText || generatingJSON || generatingPDF || !resumeFormat}
                                          onClick={() => {
                                            setChosenTemplate("twoColV3");
                                          }}
                                        >
                                          Choose me!
                                        </Button>    
                                    </DialogTrigger>
                                  </div>
                                </CarouselItem>
                              </CarouselContent>
                              <CarouselPrevious className="absolute left-4 top-1/2 translate-y-1/2"/>
                              <CarouselNext className="absolute right-4 top-1/2 translate-y-1/2"/>
                            </Carousel>
                          </DialogContent>
                        </form>
                      </Dialog>
                    )}
                    <Button
                      disabled={generatingText || generatingJSON}
                      onClick={() => handleGenerateText(selectedIndex)}
                      className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
                    >
                      {generatingText ? (
                        <>
                          <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                          Generating...
                        </>
                      ) : (
                        <>
                          <FileText className="h-4 w-4" />
                          Generate Text Resume
                        </>
                      )}
                    </Button>
                    
                    <Button
                      disabled={generatingJSON || generatingText}
                      onClick={() => handleGenerateJSON(selectedIndex)}
                      className="bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-2"
                    >
                      {generatingJSON ? (
                        <>
                          <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                          Generating...
                        </>
                      ) : (
                        <>
                          <Code className="h-4 w-4" />
                          Generate JSON Resume
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Status Messages */}
                  {status && (
                    <div className={`flex items-center gap-2 p-3 rounded-lg ${
                      status.includes("Error") 
                        ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700"
                        : "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700"
                    }`}>
                      {status.includes("Error") ? (
                        <AlertCircle className="h-4 w-4 text-red-600" />
                      ) : (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      )}
                      <span className={status.includes("Error") 
                        ? "text-red-800 dark:text-red-200" 
                        : "text-green-800 dark:text-green-200"
                      }>
                        {status}
                      </span>
                    </div>
                  )}

                  {/* Generated Resume Display */}
                  { resumeFormat === "pdf" && newResume && (
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
                      <div className="flex items-center gap-2 mb-4">
                        <h3 className="font-semibold text-gray-900 dark:text-white">Generated Resume</h3>
                        <DownloadPDFResumeButton 
                          file={newResumeFile} 
                          fileName={`${sanitizeFileName(visibleJobAds[selectedIndex]?.jobTitle || "resume")}.pdf`} 
                        />
                        <Button
                          disabled={applying}
                          onClick={handleApply}
                          className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
                        >
                          {applying ? (
                            <>
                              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                              Saving...
                            </>
                          ) : (
                            <>
                              <Check />
                              I applied with this resume
                            </>
                          )}
                        </Button>
                      </div>
                      <div className="bg-white dark:bg-gray-900 p-4 rounded border border-gray-200 dark:border-gray-700 max-h-64 overflow-auto">
                        <pre className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap font-mono">
                          
                          {/*this is where the preview (templateName, description, image) should go instead of newResume*/ newResume}
                        </pre>
                      </div>
                    </div>
                  )}

                  { resumeFormat !== "pdf" && newResume && (
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
                      <div className="flex items-center gap-2 mb-4">
                        <h3 className="font-semibold text-gray-900 dark:text-white">Generated Resume</h3>
                        <DownloadTextResumeButton 
                          text={newResume} 
                          fileName={`${sanitizeFileName(visibleJobAds[selectedIndex]?.jobTitle || "resume")}.${resumeFormat === "json" ? "json" : "txt"}`} 
                        />
                        <Button
                          disabled={applying}
                          onClick={handleApply}
                          className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
                        >
                          {applying ? (
                            <>
                              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                              Saving...
                            </>
                          ) : (
                            <>
                              <Check />
                              I applied with this resume
                            </>
                          )}
                        </Button>
                      </div>
                      <div className="bg-white dark:bg-gray-900 p-4 rounded border border-gray-200 dark:border-gray-700 max-h-64 overflow-auto">
                        <pre className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap font-mono">
                          {newResume}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}