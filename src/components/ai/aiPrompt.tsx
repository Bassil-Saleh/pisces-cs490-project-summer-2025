"use client";

import { model, jobAdParseModel, resumeModel } from "@/lib/firebase";
import { doc, getDoc, updateDoc, writeBatch, arrayUnion } from "firebase/firestore";

type dictionary = Record<string, string>;

export const AIPrompt = `Please take this text corpus submitted by a user and parse the following information from it:

1. The user’s full name.
2. The user’s email addresses.
3. The user’s phone numbers, each one formatted as XXX-XXX-XXXX where X is a number from 0 to 9. If no phone numbers are present, leave it blank.
4. The user’s city and state or country. If this is not present, leave it blank.
5. The user’s professional summary (1 to 2 paragraphs). If this is not present, leave it blank.
6. The list of work experiences the user holds.
    For each work experience the user holds, parse the following information:
      - The user’s job title.
      - The name of the company.
      - The start date of the job in YYYY-MM format.
      - The end date of the job either in YYYY-MM format. If this cannot be parsed in YYYY-MM format, substitute it with the word “Present”.
      - The summary of the job role. If this is not present, leave it blank.
      - The list of the user’s responsibilities and accomplishments while working at the job.
7. The list of educational qualifications the user holds.
    For each educational qualification the user holds, parse the following information:
      - The degree title.
      - The name of the school or university.
      - The start date in YYYY-MM format.
      - The end date in YYYY-MM format.  If this cannot be parsed in YYYY-MM format, substitute it with the word “Present”.
      - The user’s GPA. If this is not present, leave it blank.
8. The user’s list of skills.

Please return your response as a strict JSON object in the following structure:

*** Start of Resume JSON Structure ***
| Field | Type | Description |
|-------|------|-------------|
| fullName | String | Full name of the user. |
| contact | Object | User's contact details. |
| contact.email | Array of Strings | Email addresses. |
| contact.phone | Array of Strings | Phone numbers (optional; also should have the format: XXX-XXX-XXXX with X being a number from 0 to 9). |
| contact.location | String | City and state or country (optional). |
| summary | String | Professional summary (1-2 paragraphs). |
| workExperience | Array of Objects | List of work experiences, ordered most recent first. |
| workExperience[].jobTitle | String | Job title. |
| workExperience[].company | String | Company name. |
| workExperience[].startDate | String | Start date (format: YYYY-MM). |
| workExperience[].endDate | String | End date (or \"Present\"). |
| workExperience[].jobSummary | String | Summary of the job role. |
| workExperience[].responsibilities | Array of Strings | Bullet points of responsibilities/accomplishments. |
| education | Array of Objects | Educational qualifications, ordered by most recent first. |
| education[].degree | String | Degree title (e.g., \"Bachelor of Science in Computer Science\"). |
| education[].institution | String | Name of the school or university. |
| education[].startDate | String | Start date (format: YYYY-MM). |
| education[].endDate | String | End date (or \"Present\"). |
| education[].gpa | String | GPA if available (optional). |
| skills | Array of Strings | List of skills. |
*** End of Resume JSON Structure ***

Do not include any explanation, markdown, rich text, or commentary in your response.

Here is the user's text corpus:

`;

export async function getAIResponse(prompt: string, corpus: string) {
    try {
        const fullPrompt = prompt + corpus;
        //console.log(fullPrompt);
        const result = await model.generateContent(fullPrompt);
        const response = result.response;
        const text = response.text();
        // AI's response has '```json' as first line
        // and '```' as last line, which prevents
        // JSON.parse() from processing it correctly.
        var lines = text.split('\n');
        lines.splice(0,1);  // Remove 1st line
        lines.splice(-1,1); // Remove last line
        var finalResponse = lines.join('\n');
        return finalResponse;
    } catch (error) {
        console.error("Error obtaining AI response: ", error);
        return "";
    }
    
}

// Version of saveAIResponse() using a batch write.
// If any of the writes fail, none of them should succeed.
export async function saveAIResponse(responseObj: any, user: any, db: any) {
    if (!user) return;
    const documentRef = doc(db, "users", user.uid);
    try {
        const document = await getDoc(documentRef);
        if (!document.exists()) {
            console.error("Document does not exist for user: ", user.uid);
            return;
        }

        // Using a batch write here instead of individual updates because individual updates:
        // 1. Cause Firestore rate limits to be hit quicker (my primary concern 
        // because I'd like to keep the app's resource usage under the free-tier).
        // 2. Increase network latency by opening multiple connections.
        const batch = writeBatch(db);

        // Update the non-array fields first
        batch.update(documentRef, {
            "resumeFields.fullName": responseObj.fullName,
            "resumeFields.summary": responseObj.summary,
            "resumeFields.contact.location": responseObj.contact.location,
        });

        // Extract email(s) and append them to resumeFields.contact.email
        if (Array.isArray(responseObj.contact.email) && responseObj.contact.email.length > 0) {
            batch.update(documentRef, {
                "resumeFields.contact.email": arrayUnion(...responseObj.contact.email)
            });
        }
        // Extract phone number(s) and append to resumeFields.contact.phone
        if (Array.isArray(responseObj.contact.phone) && responseObj.contact.phone.length > 0) {
            batch.update(documentRef, {
                "resumeFields.contact.phone": arrayUnion(...responseObj.contact.phone)
            });
        }
        // Extract skill(s) and append to resumeFields.skills
        if (Array.isArray(responseObj.skills) && responseObj.skills.length > 0) {
            batch.update(documentRef, {
                "resumeFields.skills": arrayUnion(...responseObj.skills)
            });
        }
        // Extract work experience(s) and append to resumeFields.workExperience
        if (Array.isArray(responseObj.workExperience) && responseObj.workExperience.length > 0) {
            batch.update(documentRef, {
                "resumeFields.workExperience": arrayUnion(...responseObj.workExperience) 
            });
        }
        // Extract education credential(s) and append to resumeFields.education
        if (Array.isArray(responseObj.education) && responseObj.education.length > 0) {
            batch.update(documentRef, {
                "resumeFields.education": arrayUnion(...responseObj.education)
            });
        }

        // Commit all the updates
        await batch.commit();
        console.log("All updates committed in a single batch.");
    } catch (error) {
        console.error("Error during saveAIResponse batch update: ", error);
    }
}

export const jobAdAIPrompt = `
Extract the following information from the text of a job ad:
- Company Name
- Job Title
- Job Description

Return the result as a strict JSON object with the following structure:

*** Start of Job Ad JSON Structure ***
| Field | Type | Description |
|-------|------|-------------|
| companyName | String | The name of the company in the job ad. |
| jobTitle | String | The job title of the job ad. |
| jobDescription | String | The job description of the job ad. |
*** End of Job Ad JSON Structure ***
`;

export async function getJobAdAIResponse(aiClient: any, jobAdText: string) {
  // Replace with your actual AI call logic
  const prompt = jobAdAIPrompt + "\n\nJob Ad:\n" + jobAdText;
  const aiResponse = await aiClient(prompt);
  return aiResponse;
}

export const generateResumeAIPromptJSON = `
Use the following information submitted by a user to generate a tailored resume:

1. A JSON object representing the user's information
2. Text from a job ad

Please return your response as a strict JSON object in the following format:

*** Start of Resume JSON Structure ***
| Field | Type | Description |
|-------|------|-------------|
| fullName | String | Full name of the user. |
| contact | Object | User's contact details. |
| contact.email | Array of Strings | Email addresses. |
| contact.phone | Array of Strings | Phone numbers (optional; also should have the format: XXX-XXX-XXXX with X being a number from 0 to 9). |
| contact.location | String | City and state or country (optional). |
| summary | String | Professional summary (1-2 paragraphs). |
| workExperience | Array of Objects | List of work experiences, ordered most recent first. |
| workExperience[].jobTitle | String | Job title. |
| workExperience[].company | String | Company name. |
| workExperience[].startDate | String | Start date (format: YYYY-MM). |
| workExperience[].endDate | String | End date (or \"Present\"). |
| workExperience[].jobSummary | String | Summary of the job role. |
| workExperience[].responsibilities | Array of Strings | Bullet points of responsibilities/accomplishments. |
| education | Array of Objects | Educational qualifications, ordered by most recent first. |
| education[].degree | String | Degree title (e.g., \"Bachelor of Science in Computer Science\"). |
| education[].institution | String | Name of the school or university. |
| education[].startDate | String | Start date (format: YYYY-MM). |
| education[].endDate | String | End date (or \"Present\"). |
| education[].gpa | String | GPA if available (optional). |
| skills | Array of Strings | List of skills. |
*** End of Resume JSON Structure ***

Do not include any explanation, markdown, rich text, or commentary in your response.`;

export async function getResumeAIResponseJSON(prompt: string, resume: any, jobAd: string) {
  // prompt: AI prompt
  // resume: JSON object of the 'resumeFields' structure
  // jobAd: text from a job ad
  try {
    const fullPrompt = prompt 
    + `\n\nHere is a JSON object representing the user's information:\n\n${resume}`
    + `\n\nHere is the text of the job ad:${jobAd}\n\n`;
    // console.log(fullPrompt);
    const result = await model.generateContent(fullPrompt);
    const response = result.response;
    const text = response.text();
    // console.log(text);
    // AI's response has '```json' as first line
    // and '```' as last line, which prevents
    // JSON.parse() from processing it correctly.
    var lines = text.split('\n');
    lines.splice(0,1);  // Remove 1st line
    lines.splice(-1,1); // Remove last line
    var finalResponse = lines.join('\n');
    console.log(finalResponse)
    return finalResponse;
  } catch (error) {
      console.error("Error generating resume: ", error);
      return "";
  }
}

// plaintext resume generator
export const generateResumeAIPromptPreambleText = `
Given a JSON object with the following structure:

*** Start of Resume JSON Structure ***
| Field | Type | Description |
|-------|------|-------------|
| fullName | String | Full name of the user. |
| contact | Object | User's contact details. |
| contact.email | Array of Strings | Email addresses. |
| contact.phone | Array of Strings | Phone numbers (optional; also should have the format: XXX-XXX-XXXX with X being a number from 0 to 9). |
| contact.location | String | City and state or country (optional). |
| summary | String | Professional summary (1-2 paragraphs). |
| workExperience | Array of Objects | List of work experiences, ordered most recent first. |
| workExperience[].jobTitle | String | Job title. |
| workExperience[].company | String | Company name. |
| workExperience[].startDate | String | Start date (format: YYYY-MM). |
| workExperience[].endDate | String | End date (or \"Present\"). |
| workExperience[].jobSummary | String | Summary of the job role. |
| workExperience[].responsibilities | Array of Strings | Bullet points of responsibilities/accomplishments. |
| education | Array of Objects | Educational qualifications, ordered by most recent first. |
| education[].degree | String | Degree title (e.g., \"Bachelor of Science in Computer Science\"). |
| education[].institution | String | Name of the school or university. |
| education[].startDate | String | Start date (format: YYYY-MM). |
| education[].endDate | String | End date (or \"Present\"). |
| education[].gpa | String | GPA if available (optional). |
| skills | Array of Strings | List of skills. |
*** End of Resume JSON Structure ***

Here is the JSON object:`;

export async function getPlaintextResumeAIResponseText(prompt: string, JSONText: string) {
  // prompt: AI prompt
  // JSONText: text of JSON generated resume
  try {
    const fullPrompt = prompt + `\n\n${JSONText}\n`
                              + `\nGenerate a resume in plain text. Do not include any explanation, markdown, rich text, or commentary in your response.\n`;
    console.log(fullPrompt);

    const result = await model.generateContent(fullPrompt);
    const response = result.response;
    const finalResult = response.text();

    console.log(finalResult);
    return finalResult;
  } catch (error) {
    console.error("Error generating resume: ", error);
    return "";
  }
}

// LaTeX generator
export async function getLaTeXResumeAIResponseText(prompt: string, JSONText: string, pickedTemplate: string) {
  // prompt: AI prompt
  // JSONText: text of JSON generated resume
  // pickedTemplate: the "templateName" corresponding to the LaTeX template
  try {
    const totalPrompt = prompt + `\n\n${JSONText}\n`
                               + `\nAnd here is the LaTeX format:\n` 
                               + `\n${pickedTemplate}\n`
                               + `\nGenerate a complete LaTeX doc (with the given layout) with the appropriately substituted info from the format.\n`;
    console.log(totalPrompt);

    const outcome = await model.generateContent(totalPrompt);
    const resp = outcome.response;
    const latexDocResult = resp.text().replaceAll("\u00A0", " ").slice(9,-4);
    
    console.log(latexDocResult);
    return latexDocResult;
  } catch (error) {
    console.error("Error generating resume: ", error);
    return "";
  }
}

// all the templates LaTeX formats
export const oneColV1 = `
\\documentclass[12pt]{article}

\\usepackage[T1]{fontenc}
\\usepackage{inter}
\\usepackage{lipsum}
\\renewcommand*\\familydefault{\\sfdefault}

\\usepackage{geometry}
\\geometry{
    a4paper,
    top=1.8cm,
    bottom=1in,
    left=2.5cm,
    right=2.5cm
}

\\setcounter{secnumdepth}{0} % removes section numbering
\\pdfgentounicode=1 % make ATS friendly

\\usepackage{enumitem}
\\setlist[itemize]{
    noitemsep,
    left=2em
}
\\setlist[description]{itemsep=0pt}
\\setlist[enumerate]{align=left}
\\usepackage[dvipsnames]{xcolor}
\\usepackage{titlesec}
\\titlespacing{\\subsection}{0pt}{1em}{*0}
\\titlespacing{\\subsubsection}{0pt}{*0}{*0}
\\titleformat{\\section}{\\color{BlueViolet}\\large\\fontseries{black}\\selectfont\\uppercase}{}{}{\\ruleafter}[\\global\\RemVStrue]
\\titleformat{\\subsection}{\\fontseries{bold}\\selectfont}{}{}{\\rvs}
\\titleformat{\\subsubsection}{\\color{gray}\\fontseries{bold}\\selectfont}{}{}{}

\\usepackage{xhfill} 
\\newcommand\\ruleafter[1]{#1~\\xrfill[.5ex]{1pt}[gray]} % add rule after title in .5 x-height 

\\newif\\ifRemVS % remove vspace between \\section & \\subsection
\\newcommand{\\rvs}{
    \\ifRemVS
        \\vspace{-1.5ex}
    \\fi
    \\global\\RemVSfalse
}

\\usepackage{fontawesome5}

\\usepackage[bookmarks=false]{hyperref} % [imp!]
\\hypersetup{ 
    colorlinks=true,
    urlcolor=NavyBlue,
    pdftitle={My Resume},
}

\\usepackage[page]{totalcount}
\\usepackage{fancyhdr}
\\pagestyle{fancy}
\\renewcommand{\\headrulewidth}{0pt}	
\\fancyhf{}							

\\usepackage{amsmath}
\\usepackage{amsfonts}

\\begin{document} 
%only edit information within the \\begin{document} and \\end{document} block as instructed in the comments; if there are any special characters within each substitution, escape them by preceding them with \\

% Header Section
\\begin{center}
    {\\fontsize{28}{28}\\selectfont Your Name %fullName goes here, replacing "Your Name"
    } \\\\ \\bigskip 
    {\\color{gray}\\faMapMarker} City, State %contact.location goes here, replacing "City, State"; if contact.location is blank, delete this line and the next line
    \\quad
    {\\color{gray}\\faEnvelope[regular]} \\href{mailto:myname@email.com}{myname@email.com %contact.email[emailIdx == 0] replaces "myname@email.com" within both parts of \\href while keeping its structure; if contact.email[emailIdx == 0] is blank, delete this line and the next line
    } \\quad
    {\\color{gray}\\faIcon{mobile-alt}} \\href{tel:+123-456-7890}{123-456-789 %contact.phone[id == 0] replaces "123-456-7890" within both parts of \\href while keeping its structure; if contact.phone[id == 0] is blank, delete this line
    }
\\end{center}


% Professional Summary Section
\\section{Professional Summary}
    A 1-2-paragraph summary of your career...\\lipsum[1] %summary replaces "A 1-2-paragraph summary of your career...\\lipsum[1]"; if summary is blank, delete this line


% Education Section
\\section{Education}
    %each element in education[] goes here, following the below format, each having their own \\subsection
    \\subsection{Degree Title %education[].degree replaces "Degree Title"; if blank, replace with "n/a"
    \\hfill \\normalfont 
    YYYY-MM %education[].startDate replaces this "YYYY-MM"; if blank, replace with "?"
    to YYYY-MM %education[].endDate replaces this "YYYY-MM"; if blank, replace with "?"
    }
        \\subsubsection{Institution %education[].institution replaces "Institution"; if blank, replace with "n/a"
        }
        \\begin{itemize}
            \\vspace{.5em}
            \\item[] \\textbf{GPA:} \\textit{X.XXX %education[].gpa replaces "X.XXX", if education[].gpa is blank, replace with "n/a"
            }
        \\end{itemize}


% Work Experience Section
\\section{Work Experience}
    %each element in workExperience[] goes here, following the below format, each having their own \\subsection
    \\subsection{Job Title %workExperience[].jobTitle replaces "Job Title"; if blank, replace with "n/a"
    \\hfill \\normalfont
    YYYY-MM %workExperience[].startDate replaces this "YYYY-MM"; if blank, replace with "?"
    to YYYY-MM %workExperience[].endDate replaces this "YYYY-MM"; if blank, replace with "?"
    }
        \\subsubsection{Company %workExperience[].company replaces "Company"; if blank, replace with "n/a"
        }
        \\begin{itemize}
            \\vspace{.5em}
            \\item[] \\textbf{Job Summary:} \\lipsum[1] %workExperience[].jobSummary replaces "\\lipsum[1]"; if blank, delete this line
            \\\\
            \\item[] \\textbf{Responsibilities:}
            \\begin{enumerate}
                 %each element within workExperience[].responsibilities is listed here, each with their own \\item
                 \\item Responsibility 1
            \\end{enumerate}
        \\end{itemize}


% Skills Section
\\section{Skills}
    \\begin{itemize}
         %each element within skills is listed here, each with their own \\item[>]
        \\item[>] Skill 1
    \\end{itemize}

\\end{document}
`;

export const oneColV2 = `
\\documentclass[letterpaper, 11pt]{article}
\\usepackage{
    hyperref,
    enumitem,
    longtable,
    amsmath,
    array
}
\\usepackage[left=0.5in, right=0.6in, bottom=0.6in, top=0.6in, headsep=0in, footskip=.2in]{geometry} % page margin settings
\\renewcommand{\\baselinestretch}{1.2} %sets line spacing

\\usepackage[dvipsnames]{xcolor}
\\hypersetup{
    colorlinks=true,
    urlcolor=NavyBlue
}

\\usepackage{libertine}
\\pagenumbering{gobble} %remove page numbering

\\usepackage{lipsum}

% Define font size and color for section headings
\\newcommand{\\headingfont}{\\Large\\color{Emerald}}

% Define settings for left-hand column in which dates are printed
\\newcolumntype{R}{>{\\raggedleft}p{1in}}

% Define 'SectionTable' environment, for sections with multiple elements
\\newenvironment{SectionTable}[1]{
	\\renewcommand*{\\arraystretch}{1.7}
	\\setlength{\\tabcolsep}{10pt}
	\\begin{longtable}{Rp{5.2in}}  & #1 \\\\}
{\\end{longtable}\\vspace{-.7cm}}

% Define 'SectionTableSingleElem' environment, for sections with one element
\\newenvironment{SectionTableSingleElem}[1]{
	\\renewcommand*{\\arraystretch}{1.2}
	\\setlength{\\tabcolsep}{10pt}
	\\begin{longtable}{Rp{5.2in}} & #1 \\\\[0.6em]}
{\\end{longtable}\\vspace{-.6cm}}

% Define how lists work in 'enumerate'
\\setlist[enumerate]{
    align=left,
    noitemsep,
    labelsep=0.1em,
    topsep=0.1em
}



\\begin{document}
%only edit information within the \\begin{document} and \\end{document} block as instructed in the comments; if there are any special characters within each substitution, escape them by preceding them with \\


% Header Section
\\begin{SectionTable}{\\Huge Your Name %fullName goes here, replacing "Your Name"
} & 
City, State %contact.location goes here, replacing "City, State"; if contact.location is blank, delete this line and the next line
$\\;\\boldsymbol{\\cdot}\\;$ 
\\href{mailto:myname@email.com}{myname@email.com %contact.email[emailIdx == 0] replaces "myname@email.com" within both parts of \\href while keeping its structure; if contact.email[emailIdx == 0] is blank, delete this line and the next line
} $\\;\\boldsymbol{\\cdot}\\;$ 
\\href{tel:+123-456-7890}{123-456-789 %contact.phone[id == 0] goes replaces "123-456-7890" within both parts of \\href while keeping its structure; if contact.phone[id == 0] is blank, delete this line
}\\end{SectionTable}


% Professional Summary Section
\\begin{SectionTableSingleElem}{\\headingfont \\underline{Professional Summary}}
& \\lipsum[1] %summary replaces "\\lipsum[1]"; if summary is blank, delete this line
\\end{SectionTableSingleElem}


% Education Section
\\vspace{-1em}
\\begin{SectionTable}{\\headingfont \\underline{Education}}
    %each element in education[] goes here, following the below format
    
    YYYY-MM %education[].startDate replaces this "YYYY-MM"; if blank, replace with "?"
    to YYYY-MM %education[].endDate replaces this "YYYY-MM"; if blank, replace with "?"
    & \\textbf{\\large Institution %education[].institution replaces "Institution"; if blank, replace with "n/a"
    }\\newline
    Degree Title %education[].degree replaces "Degree Title"; if blank, replace with "n/a"
    \\newline
    \\textbf{GPA: }\\textit{X.XXX %education[].gpa replaces "X.XXX", if education[].gpa is blank, replace with "n/a"
    } \\\\
\\end{SectionTable}


% Work Experience Section
\\vspace{-1em}
\\begin{SectionTable}{\\headingfont \\underline{Work Experience}}
    %each element in workExperience[] goes here, following the below format
    YYYY-MM %workExperience[].startDate replaces this "YYYY-MM"; if blank, replace with "?"
    to YYYY-MM %workExperience[].endDate replaces this "YYYY-MM"; if blank, replace with "?"
    & \\textbf{Job Title %workExperience[].jobTitle replaces "Job Title"; if blank, replace with "n/a"
    } - \\textit{Company %workExperience[].company replaces "Company"; if blank, replace with "n/a"
    }
    \\newline
    \\textbf{Job Summary:} \\lipsum[1] %%workExperience[].jobSummary replaces "\\lipsum[1]"; if blank, replace with "n/a"
    \\vspace{1em}\\newline
    \\textbf{Responsibilities: }
    \\begin{enumerate}
        %each element within workExperience[].responsibilities is listed here, each with their own \\item
        \\item Responsibility 1
    \\end{enumerate}
    \\\\
\\end{SectionTable}


% Skills Section
\\vspace{-1em}
\\begin{SectionTableSingleElem}{\\headingfont \\underline{Skills}}
    %each element within skills is listed here, each with their own "& \\leftskip 30pt -- Skill\\\\" part
    & \\leftskip 30pt -- Skill 1 \\\\
\\end{SectionTableSingleElem} 

\\end{document}
`;

export const twoColV1 = `
\\documentclass[12pt]{article}
\\usepackage{multicol}
\\usepackage[T1]{fontenc}
\\usepackage{inter}
\\usepackage{lipsum}
\\renewcommand*\\familydefault{\\sfdefault}

\\usepackage{geometry}
\\geometry{
    a4paper,
    top=1.8cm,
    bottom=1in,
    left=2.5cm,
    right=2.5cm
}

\\setcounter{secnumdepth}{0} % remove section numbering
\\pdfgentounicode=1 % make ATS friendly

\\usepackage{enumitem}
\\setlist[itemize]{
    noitemsep,
    left=2em
}
\\setlist[description]{itemsep=0pt}
\\setlist[enumerate]{align=left}
\\usepackage[dvipsnames]{xcolor}
\\usepackage{titlesec}
\\titlespacing{\\subsection}{0pt}{*0}{*0}
\\titlespacing{\\subsubsection}{0pt}{*0}{*0}
\\titleformat{\\section}{\\color{BlueViolet}\\large\\fontseries{black}\\selectfont\\uppercase}{}{}{\\ruleafter}[\\global\\RemVStrue]
\\titleformat{\\subsection}{\\fontseries{bold}\\selectfont}{}{}{\\rvs}
\\titleformat{\\subsubsection}{\\color{gray}\\fontseries{bold}\\selectfont}{}{}{}

\\usepackage{xhfill} 
\\newcommand\\ruleafter[1]{#1~\\xrfill[.5ex]{1pt}[gray]} % add rule after title in .5 x-height 

\\newif\\ifRemVS % remove vspace between \\section & \\subsection
\\newcommand{\\rvs}{
    \\ifRemVS
        \\vspace{-1.5ex}
    \\fi
    \\global\\RemVSfalse
}

\\usepackage{fontawesome5}

\\usepackage[bookmarks=false]{hyperref} % [imp!]
\\hypersetup{ 
    colorlinks=true,
    urlcolor=NavyBlue,
    pdftitle={My Resume},
}

\\usepackage[page]{totalcount}
\\usepackage{fancyhdr}
\\pagestyle{fancy}
\\renewcommand{\\headrulewidth}{0pt}	
\\fancyhf{}							

\\usepackage{amsmath}
\\usepackage{amsfonts}

\\begin{document}
%only edit information within the \\begin{document} and \\end{document} block as instructed in the comments; if there are any special characters within each substitution, escape them by preceding them with \\

% Header Section
\\begin{center}      
    {\\fontsize{28}{28}\\selectfont Your Name %fullName goes here, replacing "Your Name"
    } \\\\ \\bigskip 
    {\\color{gray}\\faMapMarker} City, State %contact.location goes here, replacing "City, State"; if contact.location is blank, delete this line and the next line
    \\quad
    {\\color{gray}\\faEnvelope[regular]} \\href{mailto:myname@email.com}{myname@email.com %contact.email[emailIdx == 0] replaces "myname@email.com" within both parts of \\href while keeping its structure; if contact.email[emailIdx == 0] is blank, delete this line and the next line
    } \\quad
    {\\color{gray}\\faIcon{mobile-alt}} \\href{tel:+123-456-7890}{123-456-789 %contact.phone[id == 0] replaces "123-456-7890" within both parts of \\href while keeping its structure; if contact.phone[id == 0] is blank, delete this line
    }
\\end{center}

\\begin{multicols*}{2}[\\textbf{Professional Summary:}
A 1-2-paragraph summary of your career... %summary replaces "A 1-2-paragraph summary of your career..."; if summary is blank, replace with " "
]
% Education Section
\\section{Education}
    %each element in education[] goes here, following the below format, each having their own \\subsection
    \\subsection{Degree Title %education[].degree replaces "Degree Title"; if blank, replace with "n/a"
    \\\\ \\normalfont
    YYYY-MM %education[].startDate replaces this "YYYY-MM"; if blank, replace with "?"
    to YYYY-MM %education[].endDate replaces this "YYYY-MM"; if blank, replace with "?"
    }
        \\subsubsection{Institution %education[].institution replaces "Institution"; if blank, replace with "n/a"
        }
        \\begin{itemize}
            \\vspace{.5em}
            \\item[] \\textbf{GPA:} \\textit{X.XXX %education[].gpa replaces "X.XXX", if education[].gpa is blank, replace with "n/a"
            }
        \\end{itemize}


% Work Experience Section
\\section{Work Experience}
    %each element in workExperience[] goes here, following the below format, each having their own \\subsection
    \\subsection{Job Title %workExperience[].jobTitle replaces "Job Title"; if blank, replace with "n/a"
    \\\\ \\normalfont
    YYYY-MM %workExperience[].startDate replaces this "YYYY-MM"; if blank, replace with "?"
    to YYYY-MM %workExperience[].endDate replaces this "YYYY-MM"; if blank, replace with "?"
    }
        \\subsubsection{Company %workExperience[].company replaces "Company"; if blank, replace with "n/a"
        }
        \\begin{itemize}
            \\vspace{.5em}
            \\item[] \\textbf{Job Summary:} \\lipsum[1] %workExperience[].jobSummary replaces "\\lipsum[1]"; if blank, delete this line
            \\\\
            \\item[] \\textbf{Responsibilities:}
            \\begin{enumerate}
                \\item Responsibility 1 %each element within workExperience[].responsibilities is listed here, each with their own \\item
            \\end{enumerate}
        \\end{itemize}


\\section{Skills}
    \\begin{itemize}
        %each element within skills is listed here, each with their own \\item[>]
        \\item[>] Skill 1
    \\end{itemize}

\\end{multicols*}
\\end{document}
`;

export const twoColV2 = `
\\documentclass{article}

\\usepackage[top=0.5in, bottom=0.5in, left=0.5in, right=0.5in]{geometry}
\\usepackage{enumitem}
\\usepackage[dvipsnames]{xcolor}
\\usepackage{lipsum}
\\usepackage{hyperref}
\\hypersetup{ 
    colorlinks=true,
    urlcolor=NavyBlue
}
\\usepackage{multicol}
\\usepackage{enumitem}
\\setlist[itemize]{
    align=left,
    itemsep=1em,
    labelsep=0.1em,
    topsep=0.4em
}
\\setlist[enumerate]{
    align=left,
    topsep=.1em,
    noitemsep
}



\\begin{document} 
%only edit information within the \\begin{document} and \\end{document} block as instructed in the comments; if there are any special characters within each substitution, escape them by preceding them with \\

% Header Section
\\begin{center}
    \\thispagestyle{empty}
    \\huge \\textbf{Your Name %fullName goes here, replacing "Your Name"
    \\\\}
    \\normalsize
    \\href{mailto:myname@email.com}{myname@email.com %contact.email[emailIdx == 0] replaces "myname@email.com" within both parts of \\href while keeping its structure; if contact.email[emailIdx == 0] is blank, delete this line and the next line
    }$\\mid$
    \\href{tel:+123-456-7890}{123-456-7890 %contact.phone[id == 0] replaces "123-456-7890" within both parts of \\href while keeping its structure; if contact.phone[id == 0] is blank, delete this line and the next line
    }$\\mid$
    City, State %contact.location goes here, replacing "City, State"; if contact.location is blank, delete this line
    \\\\
    \\hrulefill
    
    % Professional Summary Section
    \\vspace{.8em}
    \\noindent \\textbf{\\underline{PROFESSIONAL SUMMARY}} \\\\
    \\vspace{.4em}
    \\noindent \\lipsum[1] %summary replaces "\\lipsum[1]"; if summary is blank, delete this line
    \\\\
\\end{center}

\\vspace{1em}
\\begin{multicols*}{2}

    % Education Section
    \\noindent \\textbf{\\underline{EDUCATION}} \\\\
    %each element in education[] goes here, following the below format
    \\noindent \\textbf{Institution %education[].institution replaces "Institution"; if blank, replace with "n/a"
    } \\\\ \\textit{YYYY-MM %education[].startDate replaces this "YYYY-MM"; if blank, replace with "?"
    to YYYY-MM %education[].endDate replaces this "YYYY-MM"; if blank, replace with "?"
    } \\\\
    \\textit{Degree Title %education[].degree replaces "Degree Title"; if blank, replace with "n/a"
    } \\\\ \\textbf{GPA:} \\textit{X.XXX %education[].gpa replaces "X.XXX", if education[].gpa is blank, replace with "n/a"
    } \\\\
    \\\\

    %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
    
    % Work Experience Section
    \\vspace{2em}
    \\noindent \\textbf{\\underline{WORK EXPERIENCE}} \\\\
    %each element in workExperience[] goes here, following the below format
    \\noindent \\textbf{Company %workExperience[].company replaces "Company"; if blank, replace with "n/a"
    } \\\\ YYYY-MM %workExperience[].startDate replaces this "YYYY-MM"; if blank, replace with "?"
    to YYYY-MM %workExperience[].endDate replaces this "YYYY-MM"; if blank, replace with "?"
    \\\\
    \\textit{Job Title %workExperience[].jobTitle replaces "Job Title"; if blank, replace with "n/a"
    }
    \\begin{itemize}
        \\rightskip 0pt
        \\item[] \\textbf{Job Summary:} \\lipsum[1] %workExperience[].jobSummary replaces "\\lipsum[1]"; if blank, replace with "n/a"
        \\vspace{.5em}
        \\item[] \\textbf{Responsibilities:}
        \\begin{enumerate}
            %each element within workExperience[].responsibilities is listed here, each with their own \\item
            \\item Responsibility 1
        \\end{enumerate}
    \\end{itemize}
    \\vspace{1em}
    
    %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

    % Skill Section
    \\vspace{1em}
    \\noindent \\textbf{\\underline{SKILLS}} \\\\
    \\vspace{-.8em}
    \\noindent \\begin{itemize}[label=-, noitemsep] %each element within skills is listed here, each with their own \\item
        \\item Skill 1
    \\end{itemize}
    
\\end{multicols*}

\\end{document}
`;

export const twoColV3 = `
\\documentclass[letterpaper,11pt]{article}

\\usepackage{latexsym}
\\usepackage[empty]{fullpage}
\\usepackage{titlesec}
\\usepackage{marvosym}
\\usepackage[usenames,dvipsnames]{color}
\\usepackage{verbatim}
\\usepackage{enumitem}
\\usepackage[pdftex]{hyperref}
\\usepackage{fancyhdr}
\\usepackage{graphicx}
\\usepackage{wrapfig}
\\usepackage{multirow}
\\usepackage{lipsum}
\\usepackage{multicol}

\\pagestyle{fancy}
\\fancyhf{} % clear all header and footer fields
\\fancyfoot{}
\\renewcommand{\\headrulewidth}{0pt}
\\renewcommand{\\footrulewidth}{0pt}

% Adjust margins
\\addtolength{\\oddsidemargin}{-0.375in}
\\addtolength{\\evensidemargin}{-0.375in}
\\addtolength{\\textwidth}{1in}
\\addtolength{\\topmargin}{-.5in}
\\addtolength{\\textheight}{1.0in}

\\urlstyle{same}

\\hypersetup{ 
    colorlinks=true,
    urlcolor=NavyBlue
}

\\raggedbottom
\\raggedright
\\setlength{\\tabcolsep}{0in}

% Sections formatting
\\titleformat{\\section}{
  \\vspace{1em}\\scshape\\raggedright\\large
}{}{0em}{}[\\color{black}\\titlerule \\vspace{-5pt}]

\\newcommand{\\resumeItem}[2]{
  \\item\\small{
    \\textbf{#1}{: #2 \\vspace{-2pt}}
  }
}

\\newcommand{\\resumeSubheading}[4]{
  \\vspace{-1pt}\\item
    \\begin{tabular*}{0.45\\textwidth}{l@{\\extracolsep{\\fill}}r}
      \\vspace{.5em}
      \\parbox{\\columnwidth}{#1} & #2 \\\\
      \\parbox{\\columnwidth}{\\large #3} & \\textit{\\small #4} \\\\
    \\end{tabular*}\\vspace{-5pt}
    \\vspace{1.5em}
}

\\newcommand{\\resumeSubItem}[2]{\\resumeItem{#1}{#2}\\vspace{-4pt}}

\\renewcommand{\\labelitemii}{$\\circ$}

\\newcommand{\\resumeSubHeadingListStart}{\\begin{itemize}[leftmargin=*]}
\\newcommand{\\resumeSubHeadingListEnd}{\\end{itemize}}
\\newcommand{\\resumeItemListStart}{\\begin{itemize}}
\\newcommand{\\resumeItemListEnd}{\\end{itemize}\\vspace{-5pt}}



\\begin{document}
%only edit information within the \\begin{document} and \\end{document} block as instructed in the comments; if there are any special characters within each substitution, escape them by preceding them with \\

% Header Section
\\begin{tabular*}{\\textwidth}{l@{\\extracolsep{\\fill}}r}
  \\textbf{\\huge Your Name %fullName goes here, replacing "Your Name"
  }\\\\
  \\textbf{Email}: \\href{mailto:myname@email.com}{myname@email.com %contact.email[emailIdx == 0] replaces "myname@email.com" within both parts of \\href while keeping its structure; if contact.email[emailIdx == 0] is blank, delete this line and the next line
  }\\\\
  \\textbf{Mobile}: \\href{tel:+123-456-7890}{123-456-789 %contact.phone[id == 0] replaces "123-456-7890" within both parts of \\href while keeping its structure; if contact.phone[id == 0] is blank, delete this line and the next line
  }\\\\
  City, State %contact.location goes here, replacing "City, State"; if contact.location is blank, delete this line and the next line
  \\\\
\\end{tabular*}

% Professional Summary Section
\\section{Professional Summary}
    A 1-2-paragraph summary of your career... %summary replaces "A 1-2-paragraph summary of your career..."; if summary is blank, delete this line

\\begin{multicols*}{2}[\\textbf{}]
    % Education Section
    \\section{Education}
      \\resumeSubHeadingListStart
        %each element in education[] goes here, following the below format, each getting their own \\resumeSubheading
        \\resumeSubheading
          {\\textbf{Institution %education[].institution replaces "Institution"; if blank, replace with "n/a"
          } \\\\ \\textbf{GPA:} \\textit{X.XXX %education[].gpa replaces "X.XXX", if education[].gpa is blank, replace with "n/a"
          }}{}
          {Degree Title %education[].degree replaces "Degree Title"; if blank, replace with "n/a"
          \\\\ YYYY-MM %education[].startDate replaces this "YYYY-MM"; if blank, replace with "?"
          to YYYY-MM %education[].endDate replaces this "YYYY-MM"; if blank, replace with "?"
          }{}
          
      \\resumeSubHeadingListEnd
    
    
    % Work Experience Section
    \\section{Work Experience}
      \\resumeSubHeadingListStart
        %each element in workExperience[] goes here, following the below format, each getting their own \\resumeSubheading within this \\resumeSubHeadingListStart
        \\resumeSubheading
          {\\textbf{Company %workExperience[].company replaces "Company"; if blank, replace with "n/a"
          \\\\
          } \\textit{YYYY-MM %workExperience[].startDate replaces this "YYYY-MM"; if blank, replace with "?"
          to YYYY-MM %workExperience[].endDate replaces this "YYYY-MM"; if blank, replace with "?"
          }}{}
          {Job Title %workExperience[].jobTitle replaces "Job Title"; if blank, replace with "n/a"
          }{}
          \\vspace{-1.3em}
          \\resumeItemListStart
            \\item \\textbf{Job Summary}: \\lipsum[1-2] %workExperience[].jobSummary replaces "\\lipsum[1-2]"; if blank, replace with "n/a"
            \\vspace{1em}
            \\item \\textbf{Responsibilities}
                \\resumeSubHeadingListStart
                    %each element within workExperience[].responsibilities is listed here, each with their own \\item{Responsibility \\hfill}
                    \\item{Resp 1 \\hfill}
                \\resumeSubHeadingListEnd
          \\resumeItemListEnd
        \\vspace{1em}
        
      \\resumeSubHeadingListEnd
    
    % Skills Section
    \\section{Skills}
     \\resumeSubHeadingListStart
        %each element within skills is listed here, each with their own \\item{Skill \\hfill}
        \\item{Skill 1 \\hfill}
     \\resumeSubHeadingListEnd
     
\\end{multicols*}
 
\\end{document}
`;

// where all the templates and their descriptions are stored
export const allTemplates: dictionary = {
  oneColV1: "Template 1 (default): A standard horizontal resume with dark blue stylized section headers and horizontal line dividers and a centered header section",
  oneColV2: "Template 2: A simpler horizontal resume with dates on the left of the page and resume details on the right; light blue section headers and a leftward header section",
  twoColV1: "Template 3: Template 1 but with a dual-column format",
  twoColV2: "Template 4: A muted dual-column format with standard bold-underline sectioning and a centered header section",
  twoColV3: "Template 5: A standard corporate dual-column format",
};

// Used with jobAdParseModel (which is designed to return responses strictly in JSON format)
export const parseJobAdJSONPrompt = `
Parse the following information from the text of a job ad:
- The name of the company in the job ad.
- The job title of the job ad.
- The full job description of the job ad.

Return the result as a strict JSON object with the following structure:

*** Start of Job Ad JSON Structure ***
| Field | Type | Description |
|-------|------|-------------|
| companyName | String | The name of the company in the job ad. |
| jobTitle | String | The job title of the job ad. |
| jobDescription | String | The full job description of the job ad. |
*** End of Job Ad JSON Structure ***
`

// Used with jobAdParseModel (which is designed to return responses strictly in JSON format)
export async function AIParseJobAdJSON(prompt: string, jobAdText: string) {
  try {
    const fullPrompt = prompt + `\nText of the job ad:\n` + `\n${jobAdText}\n`;
    const result = await jobAdParseModel.generateContent(fullPrompt);
    const response = result.response.text();
    return response;
  } catch (error) {
    console.error("Error parsing job ad: ", error);
    return "";
  }
}

// Used with resumeModel (which is designed to return responses strictly in JSON format)
export const generateAIResumeJSONPrompt = `
Use the following information submitted by a user to generate a tailored resume:

1. A JSON object representing the user's information
2. Text from a job ad

Please return your response as a strict JSON object in the following format:

*** Start of Resume JSON Structure ***
| Field | Type | Description |
|-------|------|-------------|
| fullName | String | Full name of the user. |
| contact | Object | User's contact details. |
| contact.email | Array of Strings | Email addresses. |
| contact.phone | Array of Strings | Phone numbers (optional; also should have the format: XXX-XXX-XXXX with X being a number from 0 to 9). |
| contact.location | String | City and state or country (optional). |
| summary | String | Professional summary (1-2 paragraphs). |
| workExperience | Array of Objects | List of work experiences, ordered most recent first. |
| workExperience[].jobTitle | String | Job title. |
| workExperience[].company | String | Company name. |
| workExperience[].startDate | String | Start date (format: YYYY-MM). |
| workExperience[].endDate | String | End date (or \"Present\"). |
| workExperience[].jobSummary | String | Summary of the job role. |
| workExperience[].responsibilities | Array of Strings | Bullet points of responsibilities/accomplishments. |
| education | Array of Objects | Educational qualifications, ordered by most recent first. |
| education[].degree | String | Degree title (e.g., \"Bachelor of Science in Computer Science\"). |
| education[].institution | String | Name of the school or university. |
| education[].startDate | String | Start date (format: YYYY-MM). |
| education[].endDate | String | End date (or \"Present\"). |
| education[].gpa | String | GPA if available (optional). |
| skills | Array of Strings | List of skills. |
*** End of Resume JSON Structure ***

Do not include any explanation, markdown, rich text, or commentary in your response.
`;

// Used with resumeModel (which is designed to return responses strictly in JSON format)
export async function generateAIResumeJSON(prompt: string, JSONText: string, jobAdText: string) {
  // prompt: AI prompt
  // JSONText: text of JSON generated resume
  try {
    const fullPrompt = prompt 
                       + `\nText of the JSON object:\n` 
                       + `\n${JSONText}\n`
                       + `\nText of the job ad:\n`
                       + `\n${jobAdText}\n`;
    const result = await resumeModel.generateContent(fullPrompt);
    const response = result.response.text();
    return response;
  } catch (error) {
    console.error("Error generating resume: ", error);
    return "";
  }
}


// export async function getResumeAIResponseText(prompt: string, resume: any, jobAd: string) {
//   // prompt: AI prompt
//   // resume: JSON object of the 'resumeFields' structure
//   // jobAd: text from a job ad
//   try {
//     const JSONText = await getResumeAIResponseJSON(prompt, resume, jobAd);
//     const fullPrompt = generateResumeAIPromptText + `\n\n${JSONText}\n`;
//     console.log(fullPrompt);

//     const result = await model.generateContent(fullPrompt);
//     const response = result.response;
//     const finalResult = response.text();

//     console.log(finalResult);
//     return finalResult;
//   } catch (error) {
//     console.error("Error generating resume: ", error);
//     return "";
//   }
// }

// Version of saveAIResponse() using individual writes.
// If at least one write fails, other writes can continue.
// export async function saveAIResponse(responseObj: any, user: any, db: any) {
//     if (user) {
//         const documentRef = doc(db, "users", user.uid);
//         try {
//             const document = await getDoc(documentRef);
//             if (!document.exists()) {
//                 console.error("Document does not exist for user: ", user.uid);
//                 return;
//             }
//             // Update the non-array fields first
//             try {
//                 await updateDoc(documentRef, {
//                     "resumeFields.fullName": responseObj.fullName,
//                     "resumeFields.summary": responseObj.summary,
//                     "resumeFields.contact.location": responseObj.contact.location,
//                 });
//             } catch (error) {
//                 console.error("Error updating non-array fields: ", error);
//             }

//             // Extract email(s) and append them to resumeFields.contact.email
//             if (Array.isArray(responseObj.contact.email) && responseObj.contact.email.length > 0) {
//                 ;
//                 try {
//                     await updateDoc(documentRef, {
//                         "resumeFields.contact.email": arrayUnion(...responseObj.contact.email)
//                     })
//                 } catch (error) {
//                     console.error("Error appending contact email(s): ", error);
//                 }
//             }
//             // Extract phone number(s) and append to resumeFields.contact.phone
//             if (Array.isArray(responseObj.contact.phone) && responseObj.contact.phone.length > 0) {
//                 try {
//                     await updateDoc(documentRef, {
//                         "resumeFields.contact.phone": arrayUnion(...responseObj.contact.phone)
//                     });
//                 } catch (error) {
//                     console.error("Error appending phone number(s) from corpus: ", error);
//                 }
//             }

//             // Extract skill(s) and append to resumeFields.skills
//             if (Array.isArray(responseObj.skills) && responseObj.skills.length > 0) {
//                 try {
//                     await updateDoc(documentRef, {
//                         "resumeFields.skills": arrayUnion(...responseObj.skills)
//                     });
//                 } catch (error) {
//                     console.error("Error fetching list of skills from corpus: ", error);
//                 }
//             }
//             // Extract work experience(s) and append to resumeFields.workExperience
//             if (Array.isArray(responseObj.workExperience) && responseObj.workExperience.length > 0) {
//                 try {
//                     await updateDoc(documentRef, { 
//                         "resumeFields.workExperience": arrayUnion(...responseObj.workExperience) 
//                     });
//                 } catch (error) {
//                     console.error("Error fetching list of work experiences from corpus: ", error);
//                 }
//             }
//             // Extract education credential(s) and append to resumeFields.education
//             if (Array.isArray(responseObj.education) && responseObj.education.length > 0) {
//                 try {
//                     await updateDoc(documentRef, { 
//                         "resumeFields.education": arrayUnion(...responseObj.education) 
//                     });
//                 } catch (error) {
//                     console.error("Error fetching list of educational credentials from corpus: ", error);
//                 }
//             }
//         } catch (error) {
//             console.error("Error: could not retrieve document;", error);
//         }
//     }
// }