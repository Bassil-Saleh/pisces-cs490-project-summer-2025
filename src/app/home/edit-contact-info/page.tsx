"use client";

import { useAuth } from "@/context/authContext";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";

export default function EditContactInfoPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");

  const [submitting, setSubmitting] = useState(false); // Tracks if form is being submitted
  const [submitted, setSubmitted] = useState(false); // Tracks if submission succeeded
  const [error, setError] = useState<string | null>(null); // Stores error message for display

  const [formChanged, setFormChanged] = useState(false); //for unsaved changes check
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) {
      loadData();
    }
    if (!loading && !user) {
      router.push("/");
    }
  }, [user, loading, router]);

  async function loadData() {
    const documentRef = doc(db, "users", user!.uid);
    const document = await getDoc(documentRef);
    if (document.exists()) {
      const data = document.data();
      setFullName(data?.resumeFields?.fullName ?? "");
      setEmail(data?.resumeFields?.contact?.email ?? "");
      setLocation(data?.resumeFields?.contact?.location ?? "");
      setPhone(data?.resumeFields?.contact?.phone ?? "");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    setSubmitting(true);   // Show spinner + disable button
    setSubmitted(false);   // Reset previous success state
    setError(null);        // Clear any previous error message

    try {
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        "resumeFields.fullName": fullName,
        "resumeFields.contact.email": email,
        "resumeFields.contact.location": location,
        "resumeFields.contact.phone": phone,
      });

      setSubmitting(false); // Hide spinner
      setSubmitted(true);   // Trigger visual success feedback
      setFormChanged(false);  // Lets page know change has been saved
      setTimeout(() => setStatusMessage(null), 1); // Removes "unsaved change" from page
    } catch (err: any) {
      console.error("Error updating contact info:", err);
      setError("Something went wrong. Please try again."); // Show error feedback
      setSubmitting(false); // Stop spinner if error occurs
    }
  }

  useEffect(() => {
    //handles reload and close tab if there are unsaved changes
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (formChanged) {
        event.preventDefault();
        event.returnValue = ''; //is deprecated but might be necessary to prompt on Chrome
      }
    };

    //handles (most) clicks on links within the page if there are unsaved changes
    const handleClick = (event: MouseEvent) => {
      if (!formChanged) return;

      const nav = document.querySelector('nav');
      if (nav && nav.contains(event.target as Node)) {
        const target = (event.target as HTMLElement).closest('a');
        if (target && target instanceof HTMLAnchorElement) {
          const confirmed = window.confirm('You have unsaved changes. Leave this page?');
          if (!confirmed) {
            event.preventDefault();
            event.stopImmediatePropagation();
          }
        }
      }

      const header = document.querySelector('header');
      if (header && header.contains(event.target as Node)) {
        const target = (event.target as HTMLElement).closest('a');
        if (target && target instanceof HTMLAnchorElement) {
          const confirmed = window.confirm('You have unsaved changes. Leave this page?');
          if (!confirmed) {
            event.preventDefault();
            event.stopImmediatePropagation();
          }
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('click', handleClick, true);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('click', handleClick, true);
    };
  }, [formChanged]);


  // Reset success and error states when user edits any field, also sets a change message
  function handleInputChange(
    setter: React.Dispatch<React.SetStateAction<string>>
  ) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setter(e.target.value);
      if (submitted) setSubmitted(false); // Hide success message if editing again
      if (error) setError(null);          // Clear error message on user change
      setFormChanged(true);               // Shows that form is changed
      setStatusMessage("There has been a change. Don't forget to save!"); // Visual affirmation of change
    };
  }

  if (loading) return <p>Loading...</p>;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-xl mx-auto p-6">
      <h2 className="text-l font-bold">Full Name:</h2>
      <input
        type="text"
        name="fullName"
        value={fullName}
        onChange={handleInputChange(setFullName)}
        placeholder="Enter your full name here"
        className="border p-2 rounded w-full"
      />

      <h2 className="text-l font-bold">Email Address:</h2>
      <input
        type="email"
        name="email"
        value={email}
        onChange={handleInputChange(setEmail)}
        placeholder="Enter your email address here"
        className="border p-2 rounded w-full"
      />

      <h2 className="text-l font-bold">Phone Number (Format: 123-456-7890):</h2>
      <input
        type="tel"
        name="phone"
        pattern="[0-9]{3}-[0-9]{3}-[0-9]{4}"
        value={phone}
        onChange={handleInputChange(setPhone)}
        placeholder="Enter your number here"
        className="border p-2 rounded w-full"
      />

      <h2 className="text-l font-bold">Location:</h2>
      <input
        type="text"
        name="location"
        value={location}
        onChange={handleInputChange(setLocation)}
        placeholder="Enter your location here"
        className="border p-2 rounded w-full"
      />
      {statusMessage == "There has been a change. Don't forget to save!" && <p className="mt-2 text-sm text-yellow-400">{statusMessage}</p>}
      {/* SUBMIT BUTTON with dynamic styles for submitting and submitted states */}
      <button
        type="submit"
        disabled={submitting}
        className={`px-4 py-2 rounded text-white font-semibold transition duration-300 flex items-center justify-center space-x-2 ${
          submitted
            ? "bg-green-600 cursor-not-allowed" // Success styling
            : submitting
            ? "bg-gray-500 cursor-wait"         // Disabled + spinner styling
            : "bg-blue-600 hover:bg-blue-700 cursor-pointer" // Normal
        }`}
      >
        {/* Spinner icon while submitting */}
        {submitting && (
          <svg
            className="animate-spin h-5 w-5 text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            ></path>
          </svg>
        )}
        {/* Dynamic button label */}
        <span>
          {submitting ? "Submitting..." : submitted ? "Submitted!" : "Submit"}
        </span>
      </button>

      {/* SUCCESS MESSAGE */}
      {submitted && (
        <p className="text-green-700 font-semibold mt-4 text-center">
          Contact info updated successfully!
        </p>
      )}

      {/* ERROR MESSAGE */}
      {error && (
        <p className="text-red-600 font-semibold mt-4 text-center">
          {error}
        </p>
      )}
    </form>
  );
}
