"use client";

import { Star } from "lucide-react";

export default function TrackApplicationsPage() {
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