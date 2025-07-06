import { NextRequest, NextResponse } from "next/server";

interface JobAd {
    companyName: string;
    jobTitle: string;
    jobDescription: string;
    dateSubmitted: any;
}

interface AdviceRequest {
    jobAd: JobAd;
    resumeText: string;
    userId: string;
}

export async function POST(request: NextRequest) {
    try {
        const body: AdviceRequest = await request.json();
        
        // Validate required fields
        if (!body.jobAd || !body.resumeText || !body.userId) {
            return NextResponse.json(
                { error: "Missing required fields: jobAd, resumeText, or userId" },
                { status: 400 }
            );
        }

        // Generate advice using AI or predefined logic
        const advice = await generateCareerAdvice(body.jobAd, body.resumeText);

        return NextResponse.json({
            advice: advice,
            timestamp: new Date().toISOString(),
        });

    } catch (error) {
        console.error("Error generating advice:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

async function generateCareerAdvice(jobAd: JobAd, resumeText: string): Promise<string> {
    // Analyze the resume and job requirements more thoroughly
    const jobSkills = extractJobSkills(jobAd.jobDescription);
    const resumeSkills = extractResumeSkills(resumeText);
    const matchingSkills = findMatchingSkills(jobSkills, resumeSkills);
    const missingSkills = findMissingSkills(jobSkills, resumeSkills);
    const interviewQuestions = generateInterviewQuestions(jobAd);
    
    // Calculate more accurate match score
    const matchScore = calculateAdvancedMatchScore(resumeText, jobAd.jobDescription, matchingSkills, jobSkills);
    
    const advice = `Career Advice for ${jobAd.jobTitle} at ${jobAd.companyName}

RESUME ANALYSIS & IMPROVEMENT SUGGESTIONS

Skills Assessment:
${matchScore < 30 ? 
    `Your resume shows limited alignment with this ${jobAd.jobTitle} position. The job requires specialized skills and experience that aren't clearly evident in your current resume. This doesn't mean you can't apply, but you'll need to strengthen your application significantly.` :
    matchScore < 60 ? 
    `Your resume shows some relevant experience for this ${jobAd.jobTitle} role, but there are several key areas where you could improve your match with the job requirements.` :
    matchScore < 80 ?
    `Your resume demonstrates good alignment with this ${jobAd.jobTitle} position. You have many of the required skills, and with some targeted improvements, you could be a strong candidate.` :
    `Excellent! Your resume shows strong alignment with this ${jobAd.jobTitle} role. You have most of the required skills and experience. Focus on fine-tuning your application to stand out from other qualified candidates.`
}

Key Skills You're Missing:
${missingSkills.length > 0 ? 
    missingSkills.slice(0, 6).map(skill => `• ${skill}`).join('\n') :
    'You have most of the key skills mentioned in the job posting.'
}

Skills You Should Highlight:
${matchingSkills.length > 0 ? 
    matchingSkills.slice(0, 6).map(skill => `• ${skill} - Make sure this is prominently featured`).join('\n') :
    'Consider adding more specific technical skills and relevant experience to your resume.'
}

Resume Improvement Tips:
• Add specific metrics and numbers to your accomplishments (e.g., "increased efficiency by 25%", "managed team of 8 people")
• Use strong action verbs to start each bullet point (achieved, implemented, led, optimized)
• Keep your most relevant experience at the top
• Tailor your professional summary to match this specific role
• Ensure consistent formatting and remove any typos

TARGETING THIS SPECIFIC JOB

To better target this ${jobAd.jobTitle} position:
• Rewrite your professional summary to emphasize experience directly relevant to ${jobAd.jobTitle}
• Reorganize your skills section to put the most job-relevant skills first
• Lead with accomplishments that directly relate to the responsibilities mentioned in this job posting
• Use keywords from the job description naturally throughout your resume

${matchScore < 40 ? 
    `Important: This role requires specific expertise in ${jobAd.jobTitle} that may not be reflected in your current resume. Consider gaining relevant experience through:
    • Volunteer work or internships in related fields
    • Taking on projects that demonstrate relevant skills
    • Pursuing relevant certifications or training programs` :
    ''
}

ADDRESSING SKILL GAPS

Learning Recommendations:
${missingSkills.length > 0 ? 
    `To strengthen your candidacy, consider developing these skills:\n${generateLearningRecommendations(missingSkills.slice(0, 4))}` :
    `Since you have most required skills, focus on:\n• Staying current with industry trends and best practices\n• Developing leadership and soft skills\n• Obtaining relevant certifications to stand out from other candidates`
}

${matchScore >= 70 ? 
    `To be in the top 1% of candidates for this ${jobAd.jobTitle} role:
    • Obtain industry-recognized certifications relevant to this position
    • Develop expertise in emerging technologies or methodologies in your field
    • Build a portfolio of impressive projects that demonstrate your capabilities
    • Network with professionals in similar roles at ${jobAd.companyName} or similar companies
    • Consider writing blog posts or giving presentations about your expertise` :
    ''
}

INTERVIEW PREPARATION

Key Questions to Prepare For:

Behavioral Questions:
${interviewQuestions.behavioral.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Role-Specific Questions:
${interviewQuestions.technical.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Interview Strategy:
• Prepare specific examples using the STAR method (Situation, Task, Action, Result)
• Research ${jobAd.companyName}'s recent news, values, and company culture
• Prepare thoughtful questions about the role, team, and company direction
• Practice explaining your experience in terms that relate to this specific job

APPLICATION STRATEGY

Your Match Score: ${matchScore}% alignment with this position

${matchScore >= 80 ? 
    `Strong match! This looks like an excellent opportunity. Apply with confidence and focus on showcasing your most relevant achievements.` :
    matchScore >= 60 ?
    `Good potential match. With some resume improvements and targeted preparation, you could be a competitive candidate.` :
    matchScore >= 40 ?
    `This role might be a stretch, but it could be a great growth opportunity. Focus on demonstrating your ability to learn and adapt quickly.` :
    `This position requires significant additional experience or skills. Consider it a long-term goal and focus on building the necessary qualifications first.`
}

Next Steps:
1. Update your resume using the suggestions above
2. Apply for this position and similar roles
3. Continue developing the missing skills identified
4. Network with professionals in this field
5. Keep track of your applications and follow up appropriately

Remember: Every application is a learning opportunity. Use this feedback to continuously improve your job search strategy. Good luck with your application to ${jobAd.companyName}!`;

    return advice.trim();
}

function extractJobSkills(jobDescription: string): string[] {
    const skills: string[] = [];
    const jobLower = jobDescription.toLowerCase();
    
    // Comprehensive skill list covering various job types
    const allSkills = [
        // Technical Skills
        'javascript', 'python', 'java', 'react', 'node.js', 'sql', 'html', 'css', 'typescript',
        'aws', 'azure', 'docker', 'kubernetes', 'git', 'linux', 'windows', 'mongodb', 'postgresql',
        'api', 'rest', 'graphql', 'microservices', 'cloud', 'devops', 'ci/cd', 'jenkins',
        'machine learning', 'ai', 'data analysis', 'excel', 'powerbi', 'tableau', 'analytics',
        
        // Trade Skills
        'electrical', 'plumbing', 'hvac', 'carpentry', 'welding', 'construction', 'maintenance',
        'mechanical', 'automotive', 'painting', 'roofing', 'flooring', 'installation', 'repair',
        'wiring', 'circuit', 'voltage', 'blueprint', 'safety', 'osha', 'power tools', 'hand tools',
        
        // Healthcare Skills
        'nursing', 'medical', 'patient care', 'cpr', 'first aid', 'healthcare', 'clinical',
        'pharmacy', 'dental', 'physical therapy', 'mental health', 'medical records', 'hipaa',
        
        // Business Skills
        'project management', 'agile', 'scrum', 'leadership', 'team management', 'communication',
        'problem solving', 'analytical', 'strategic planning', 'budget management', 'sales',
        'marketing', 'customer service', 'negotiation', 'presentation', 'training', 'coaching',
        'stakeholder management', 'process improvement', 'quality assurance', 'compliance',
        
        // Education Skills
        'teaching', 'curriculum', 'lesson planning', 'classroom management', 'assessment',
        'special education', 'tutoring', 'educational technology', 'student engagement',
        
        // Finance Skills
        'accounting', 'bookkeeping', 'financial analysis', 'budgeting', 'tax preparation',
        'auditing', 'financial planning', 'investment', 'banking', 'payroll', 'quickbooks',
        
        // Legal Skills
        'legal research', 'contract review', 'litigation', 'compliance', 'regulatory',
        'paralegal', 'legal writing', 'case management', 'court procedures',
        
        // Creative Skills
        'graphic design', 'web design', 'photography', 'video editing', 'content creation',
        'copywriting', 'social media', 'branding', 'adobe', 'photoshop', 'illustrator',
        
        // Service Skills
        'customer service', 'food service', 'retail', 'hospitality', 'cleaning', 'security',
        'logistics', 'warehouse', 'inventory', 'shipping', 'receiving', 'forklift'
    ];
    
    allSkills.forEach(skill => {
        if (jobLower.includes(skill)) {
            skills.push(skill);
        }
    });
    
    return [...new Set(skills)]; // Remove duplicates
}

function extractResumeSkills(resumeText: string): string[] {
    const skills: string[] = [];
    const resumeLower = resumeText.toLowerCase();
    
    // Use same comprehensive skill list as job skills
    const allSkills = [
        // Technical Skills
        'javascript', 'python', 'java', 'react', 'node.js', 'sql', 'html', 'css', 'typescript',
        'aws', 'azure', 'docker', 'kubernetes', 'git', 'linux', 'windows', 'mongodb', 'postgresql',
        'api', 'rest', 'graphql', 'microservices', 'cloud', 'devops', 'ci/cd', 'jenkins',
        'machine learning', 'ai', 'data analysis', 'excel', 'powerbi', 'tableau', 'analytics',
        
        // Trade Skills
        'electrical', 'plumbing', 'hvac', 'carpentry', 'welding', 'construction', 'maintenance',
        'mechanical', 'automotive', 'painting', 'roofing', 'flooring', 'installation', 'repair',
        'wiring', 'circuit', 'voltage', 'blueprint', 'safety', 'osha', 'power tools', 'hand tools',
        
        // Healthcare Skills
        'nursing', 'medical', 'patient care', 'cpr', 'first aid', 'healthcare', 'clinical',
        'pharmacy', 'dental', 'physical therapy', 'mental health', 'medical records', 'hipaa',
        
        // Business Skills
        'project management', 'agile', 'scrum', 'leadership', 'team management', 'communication',
        'problem solving', 'analytical', 'strategic planning', 'budget management', 'sales',
        'marketing', 'customer service', 'negotiation', 'presentation', 'training', 'coaching',
        'stakeholder management', 'process improvement', 'quality assurance', 'compliance',
        
        // Education Skills
        'teaching', 'curriculum', 'lesson planning', 'classroom management', 'assessment',
        'special education', 'tutoring', 'educational technology', 'student engagement',
        
        // Finance Skills
        'accounting', 'bookkeeping', 'financial analysis', 'budgeting', 'tax preparation',
        'auditing', 'financial planning', 'investment', 'banking', 'payroll', 'quickbooks',
        
        // Legal Skills
        'legal research', 'contract review', 'litigation', 'compliance', 'regulatory',
        'paralegal', 'legal writing', 'case management', 'court procedures',
        
        // Creative Skills
        'graphic design', 'web design', 'photography', 'video editing', 'content creation',
        'copywriting', 'social media', 'branding', 'adobe', 'photoshop', 'illustrator',
        
        // Service Skills
        'customer service', 'food service', 'retail', 'hospitality', 'cleaning', 'security',
        'logistics', 'warehouse', 'inventory', 'shipping', 'receiving', 'forklift'
    ];
    
    allSkills.forEach(skill => {
        if (resumeLower.includes(skill)) {
            skills.push(skill);
        }
    });
    
    return [...new Set(skills)]; // Remove duplicates
}

function findMatchingSkills(jobSkills: string[], resumeSkills: string[]): string[] {
    const matching: string[] = [];
    
    jobSkills.forEach(jobSkill => {
        resumeSkills.forEach(resumeSkill => {
            if (jobSkill.toLowerCase() === resumeSkill.toLowerCase()) {
                matching.push(jobSkill);
            }
        });
    });
    
    return [...new Set(matching)]; // Remove duplicates
}

function findMissingSkills(jobSkills: string[], resumeSkills: string[]): string[] {
    const missing: string[] = [];
    const resumeSkillsLower = resumeSkills.map(skill => skill.toLowerCase());
    
    jobSkills.forEach(jobSkill => {
        if (!resumeSkillsLower.includes(jobSkill.toLowerCase())) {
            missing.push(jobSkill);
        }
    });
    
    return missing;
}

function calculateAdvancedMatchScore(resumeText: string, jobDescription: string, matchingSkills: string[], jobSkills: string[]): number {
    const resumeLower = resumeText.toLowerCase();
    const jobLower = jobDescription.toLowerCase();
    
    let score = 0;
    let maxScore = 0;
    
    // Check for job title or similar role experience
    const jobTitleWords = jobDescription.match(/job title|position|role:\s*([^.\n]+)/i);
    if (jobTitleWords) {
        const titleKeywords = jobTitleWords[1]?.toLowerCase().split(/\s+/) || [];
        titleKeywords.forEach(word => {
            if (word.length > 3 && resumeLower.includes(word)) {
                score += 15;
            }
        });
        maxScore += titleKeywords.length * 15;
    }
    
    // Check for industry-specific experience
    const industryKeywords = ['years', 'experience', 'background', 'worked', 'employed'];
    industryKeywords.forEach(keyword => {
        if (jobLower.includes(keyword) && resumeLower.includes(keyword)) {
            score += 5;
        }
        maxScore += 5;
    });
    
    // Check for required skills
    if (jobSkills.length > 0) {
        const skillScore = (matchingSkills.length / jobSkills.length) * 50;
        score += skillScore;
        maxScore += 50;
    }
    
    // Check for education requirements
    const educationKeywords = ['degree', 'bachelor', 'master', 'certification', 'diploma'];
    educationKeywords.forEach(keyword => {
        if (jobLower.includes(keyword) && resumeLower.includes(keyword)) {
            score += 10;
        }
        if (jobLower.includes(keyword)) {
            maxScore += 10;
        }
    });
    
    // If no specific criteria found, base on skill overlap
    if (maxScore === 0) {
        if (jobSkills.length === 0) return 50; // Default neutral score
        return Math.min(90, (matchingSkills.length / Math.max(jobSkills.length, 1)) * 100);
    }
    
    const finalScore = Math.min(95, Math.max(5, (score / maxScore) * 100));
    return Math.round(finalScore);
}

function generateInterviewQuestions(jobAd: JobAd): { behavioral: string[]; technical: string[] } {
    const behavioral = [
        "Tell me about a time when you had to overcome a significant challenge at work.",
        "Describe a situation where you had to work with a difficult team member.",
        "Give me an example of when you had to learn a new skill quickly.",
        "Tell me about a time when you had to meet a tight deadline.",
        "Describe a situation where you had to make a difficult decision with limited information."
    ];
    
    const technical = [
        "What interests you most about working as a " + jobAd.jobTitle + "?",
        "How would you approach a typical day in this " + jobAd.jobTitle + " role?",
        "What do you know about " + jobAd.companyName + " and why do you want to work here?",
        "How do you stay current with industry trends and developments?",
        "Describe your experience with the key responsibilities mentioned in this job description."
    ];
    
    return { behavioral, technical };
}

function generateLearningRecommendations(skills: string[]): string {
    const recommendations = skills.map(skill => {
        const skillLower = skill.toLowerCase();
        if (skillLower.includes('javascript') || skillLower.includes('react')) {
            return `• ${skill}: FreeCodeCamp, Coursera JavaScript courses, or React documentation`;
        } else if (skillLower.includes('python')) {
            return `• ${skill}: Python.org tutorial, Codecademy Python course, or Coursera Python specialization`;
        } else if (skillLower.includes('aws')) {
            return `• ${skill}: AWS Free Tier, AWS Cloud Practitioner certification, or A Cloud Guru`;
        } else if (skillLower.includes('project management')) {
            return `• ${skill}: Google Project Management Certificate, PMP certification, or Coursera Project Management courses`;
        } else if (skillLower.includes('data') || skillLower.includes('analytics')) {
            return `• ${skill}: Google Data Analytics Certificate, Coursera Data Science specialization, or Kaggle Learn`;
        } else if (skillLower.includes('electrical')) {
            return `• ${skill}: NECA training programs, electrical apprenticeship, or local trade school courses`;
        } else if (skillLower.includes('plumbing')) {
            return `• ${skill}: plumbing apprenticeship, vocational training, or local trade school programs`;
        } else if (skillLower.includes('hvac')) {
            return `• ${skill}: HVAC certification programs, EPA 608 certification, or trade school training`;
        } else if (skillLower.includes('nursing')) {
            return `• ${skill}: nursing degree programs, CNA certification, or continuing education courses`;
        } else if (skillLower.includes('medical')) {
            return `• ${skill}: medical training programs, healthcare certifications, or continuing education`;
        } else {
            return `• ${skill}: LinkedIn Learning, Coursera, or Udemy courses`;
        }
    });
    
    return recommendations.join('\n');
}




