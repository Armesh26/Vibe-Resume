from flask import Flask, render_template, request, send_file, jsonify
from typing import Optional, Tuple
import subprocess
import os
import tempfile
import uuid
import shutil
import google.generativeai as genai
from dotenv import load_dotenv
import PyPDF2
import io

load_dotenv()

app = Flask(__name__)

# Configure Gemini
genai.configure(api_key=os.getenv('GEMINI_API_KEY'))
model = genai.GenerativeModel('gemini-2.0-flash')

# Store generated PDFs temporarily
TEMP_DIR = os.path.join(tempfile.gettempdir(), 'latex_resumes')
os.makedirs(TEMP_DIR, exist_ok=True)

SAMPLE_TEMPLATES = {
    "minimal": r"""\documentclass[11pt,a4paper]{article}
\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc}
\usepackage{geometry}
\usepackage{enumitem}
\usepackage{titlesec}
\usepackage{xcolor}
\usepackage{hyperref}

\geometry{margin=0.75in}
\pagestyle{empty}
\setlist[itemize]{nosep, leftmargin=1.5em}

\definecolor{accent}{RGB}{44, 62, 80}
\titleformat{\section}{\large\bfseries\color{accent}}{}{0em}{}[\titlerule]
\titlespacing*{\section}{0pt}{1.5ex}{1ex}

\begin{document}

\begin{center}
    {\Huge\bfseries John Doe}\\[0.3em]
    \href{mailto:john.doe@email.com}{john.doe@email.com} | 
    (555) 123-4567 | 
    San Francisco, CA | 
    \href{https://linkedin.com/in/johndoe}{linkedin.com/in/johndoe}
\end{center}

\section{Experience}
\textbf{Senior Software Engineer} \hfill \textit{Jan 2022 -- Present}\\
\textit{Tech Corp Inc., San Francisco, CA}
\begin{itemize}
    \item Led development of microservices architecture serving 1M+ daily users
    \item Reduced system latency by 40\% through optimization initiatives
    \item Mentored team of 5 junior developers
\end{itemize}

\textbf{Software Engineer} \hfill \textit{Jun 2019 -- Dec 2021}\\
\textit{StartupXYZ, Palo Alto, CA}
\begin{itemize}
    \item Built RESTful APIs using Python and Flask
    \item Implemented CI/CD pipelines reducing deployment time by 60\%
\end{itemize}

\section{Education}
\textbf{B.S. Computer Science} \hfill \textit{2015 -- 2019}\\
\textit{University of California, Berkeley}

\section{Skills}
\textbf{Languages:} Python, JavaScript, Go, SQL\\
\textbf{Technologies:} Docker, Kubernetes, AWS, React, PostgreSQL

\end{document}
""",
    "modern": r"""\documentclass[11pt,a4paper]{article}
\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc}
\usepackage{geometry}
\usepackage{enumitem}
\usepackage{titlesec}
\usepackage{xcolor}
\usepackage{hyperref}

\geometry{margin=0.6in}
\pagestyle{empty}
\setlist[itemize]{nosep, leftmargin=1.5em}

\definecolor{accent}{RGB}{52, 152, 219}
\definecolor{darkgray}{RGB}{51, 51, 51}
\definecolor{lightgray}{RGB}{150, 150, 150}

\titleformat{\section}{\Large\bfseries\color{darkgray}}{}{0em}{}
\titlespacing*{\section}{0pt}{2ex}{1.5ex}

\hypersetup{colorlinks=true, urlcolor=accent}

\begin{document}

\begin{center}
    {\fontsize{28}{34}\selectfont\bfseries\color{darkgray} Sarah Johnson}\\[0.5em]
    {\color{lightgray} sarah.johnson@email.com \quad (555) 987-6543 \quad New York, NY}\\[0.3em]
    {\color{accent}\href{https://linkedin.com/in/sarahjohnson}{linkedin.com/in/sarahjohnson} \quad \href{https://github.com/sarahjohnson}{github.com/sarahjohnson}}
\end{center}

\vspace{1em}

\section{About Me}
Creative and detail-oriented Full Stack Developer with 5+ years of experience building scalable web applications.

\section{Experience}

\textbf{\color{darkgray}Lead Developer} \hfill {\color{lightgray}\textit{2021 -- Present}}\\
{\color{accent}Digital Solutions Inc.} -- New York, NY
\begin{itemize}
    \item Architected cloud-native applications on AWS achieving 99.9\% uptime
    \item Led agile team of 8 developers delivering 15+ product launches
\end{itemize}

\section{Education}

\textbf{\color{darkgray}M.S. Computer Science} \hfill {\color{lightgray}\textit{2016 -- 2018}}\\
{\color{accent}Columbia University} -- New York, NY

\section{Technical Skills}
JavaScript, TypeScript, Python, React, Node.js, AWS, Docker, PostgreSQL, MongoDB

\end{document}
"""
}

LATEX_SYSTEM_PROMPT = """You are an expert LaTeX resume generator. Your task is to create professional, clean, one-page LaTeX resumes.

CRITICAL RULES - FOLLOW EXACTLY:
1. Output ONLY valid LaTeX code - no explanations, no markdown, no code blocks
2. Use ONLY lowercase for environments: \\begin{itemize}, \\begin{document}, etc. NEVER uppercase
3. Keep the resume to ONE page
4. Escape special characters: \\% \\& \\$ \\# \\_ 
5. Use -- for date ranges (2020 -- 2024)
6. ALWAYS define colors before using them with \\definecolor{name}{RGB}{r,g,b}
7. Use ONLY colors you have defined - never use undefined color names

USE THIS EXACT TEMPLATE STRUCTURE WITH COLORS:

\\documentclass[10pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{geometry}
\\usepackage{enumitem}
\\usepackage{titlesec}
\\usepackage{hyperref}
\\usepackage{xcolor}

\\geometry{margin=0.5in}
\\pagestyle{empty}
\\setlist[itemize]{nosep, leftmargin=1.2em, topsep=2pt}

% Define colors BEFORE using them
\\definecolor{accent}{RGB}{44, 62, 80}
\\definecolor{darkblue}{RGB}{0, 51, 102}
\\definecolor{lightgray}{RGB}{100, 100, 100}

\\titleformat{\\section}{\\large\\bfseries\\color{accent}\\uppercase}{}{0em}{}[\\titlerule]
\\titlespacing*{\\section}{0pt}{8pt}{4pt}
\\hypersetup{colorlinks=true, urlcolor=darkblue, linkcolor=darkblue}

\\begin{document}

\\begin{center}
{\\LARGE \\textbf{NAME HERE}}\\\\[0.3em]
{\\color{lightgray} phone $|$ email $|$ location}
\\end{center}

\\section{Education}
\\textbf{University Name} \\hfill {\\color{lightgray}2020 -- 2024}\\\\
Degree Name

\\section{Skills}
\\textbf{Category:} Skill1, Skill2, Skill3

\\section{Experience}
\\textbf{Job Title} $|$ {\\color{accent}\\textbf{Company Name}} \\hfill {\\color{lightgray}Month YYYY -- Present}
\\begin{itemize}
\\item Achievement or responsibility
\\end{itemize}

\\end{document}

IMPORTANT: Always define ALL colors at the top using \\definecolor before using them anywhere in the document."""


def find_pdflatex() -> Optional[str]:
    """Find pdflatex executable."""
    if shutil.which('pdflatex'):
        return 'pdflatex'
    
    common_paths = [
        '/Library/TeX/texbin/pdflatex',
        '/usr/local/texlive/2024/bin/universal-darwin/pdflatex',
        '/usr/local/texlive/2025/bin/universal-darwin/pdflatex',
        '/usr/bin/pdflatex',
        '/usr/local/bin/pdflatex',
    ]
    
    for path in common_paths:
        if os.path.isfile(path) and os.access(path, os.X_OK):
            return path
    
    return None


def compile_latex(latex_code: str) -> Tuple[bool, str, Optional[str]]:
    """Compile LaTeX code to PDF. Returns (success, message, pdf_path)."""
    
    pdflatex_path = find_pdflatex()
    if not pdflatex_path:
        return False, "pdflatex not found. Please install LaTeX:\n• macOS: brew install --cask mactex-no-gui\n• Ubuntu: sudo apt install texlive-full\n• Windows: Install MiKTeX from miktex.org", None
    
    job_id = str(uuid.uuid4())
    job_dir = os.path.join(TEMP_DIR, job_id)
    os.makedirs(job_dir, exist_ok=True)
    
    tex_file = os.path.join(job_dir, 'resume.tex')
    pdf_file = os.path.join(job_dir, 'resume.pdf')
    
    try:
        with open(tex_file, 'w', encoding='utf-8') as f:
            f.write(latex_code)
        
        for _ in range(2):
            result = subprocess.run(
                [pdflatex_path, '-interaction=nonstopmode', '-output-directory', job_dir, tex_file],
                capture_output=True,
                text=True,
                timeout=60
            )
        
        if os.path.exists(pdf_file):
            return True, "PDF generated successfully!", pdf_file
        else:
            log_file = os.path.join(job_dir, 'resume.log')
            error_msg = "Compilation failed."
            if os.path.exists(log_file):
                with open(log_file, 'r', encoding='utf-8', errors='ignore') as f:
                    log_content = f.read()
                    lines = log_content.split('\n')
                    errors = [l for l in lines if l.startswith('!') or 'Error' in l][:5]
                    if errors:
                        error_msg = '\n'.join(errors)
            return False, error_msg, None
            
    except subprocess.TimeoutExpired:
        return False, "Compilation timed out.", None
    except Exception as e:
        return False, f"Error: {str(e)}", None


def extract_text_from_pdf(pdf_file) -> str:
    """Extract text content from uploaded PDF."""
    try:
        pdf_reader = PyPDF2.PdfReader(pdf_file)
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text() + "\n"
        return text.strip()
    except Exception as e:
        return f"Error extracting PDF: {str(e)}"


VALIDATION_PROMPT = """You are a resume assistant. Analyze the user's input and categorize it.

Categories:
1. GENERATE - User wants to create or modify a resume (e.g., "make a resume for X", "add Python to skills", "change the font")
2. QUESTION - User is asking for advice about their resume content (e.g., "should I include X?", "is this a good idea?", "what do you think about Y?")
3. INVALID - Not resume-related (e.g., "hey", "hello", "write python code", general chat)
4. NOT_A_RESUME - Uploaded document is not a resume

Respond with ONLY one of these exact formats:
- GENERATE: [reason]
- QUESTION: [reason]
- INVALID: [reason]
- NOT_A_RESUME: [reason]"""


ADVICE_PROMPT = """You are a helpful resume advisor. The user is asking for advice about their current resume.

CURRENT RESUME CONTENT:
{context}

USER QUESTION: {question}

INSTRUCTIONS:
1. Analyze the resume content above to understand what the user is referring to
2. If they mention "last bullet point", "first section", etc., look at the actual content
3. Give specific advice based on what you see in their resume
4. Keep response brief (2-4 sentences)
5. Ask if they'd like you to make the change

Do NOT output any LaTeX code. Respond conversationally."""


def validate_request(user_input: str) -> tuple:
    """Check request type. Returns (request_type, message)."""
    try:
        response = model.generate_content(
            [VALIDATION_PROMPT, f"User input: {user_input}"],
            generation_config=genai.types.GenerationConfig(temperature=0.1)
        )
        
        result = response.text.strip().upper()
        
        if result.startswith("GENERATE"):
            return "generate", None
        elif result.startswith("QUESTION"):
            return "question", None
        elif result.startswith("NOT_A_RESUME"):
            return "invalid", "The uploaded document doesn't appear to be a resume. Please upload a valid resume/CV."
        else:
            return "invalid", "I'm a resume builder assistant. I can help you create, modify, or improve resumes. Please provide resume-related information or upload a resume PDF."
            
    except Exception as e:
        return "generate", None


def get_advice_response(question: str, context: str = "") -> str:
    """Get conversational advice about resume content."""
    try:
        prompt = ADVICE_PROMPT.format(context=context or "No resume loaded yet", question=question)
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(temperature=0.7)
        )
        return response.text.strip()
    except Exception as e:
        return f"I'd be happy to help with that! Could you provide more details about what you'd like to change?"


def generate_latex_with_gemini(user_input: str, is_modification: bool = False) -> str:
    """Use Gemini to generate LaTeX code from user input."""
    try:
        if is_modification:
            prompt = f"""Based on this request, modify the LaTeX resume code:

{user_input}

Remember: Output ONLY valid LaTeX code, no explanations."""
        else:
            prompt = f"""Create a professional one-page LaTeX resume from this information:

{user_input}

Remember: Output ONLY valid LaTeX code, no explanations or markdown code blocks."""
        
        response = model.generate_content(
            [LATEX_SYSTEM_PROMPT, prompt],
            generation_config=genai.types.GenerationConfig(
                temperature=0.3,
            )
        )
        
        latex_code = response.text.strip()
        
        # Clean up any markdown code blocks if present
        if latex_code.startswith('```'):
            lines = latex_code.split('\n')
            if lines[0].startswith('```'):
                lines = lines[1:]
            if lines and lines[-1].strip() == '```':
                lines = lines[:-1]
            latex_code = '\n'.join(lines)
        
        return latex_code
        
    except Exception as e:
        return f"Error generating LaTeX: {str(e)}"


@app.route('/')
def index():
    return render_template('index.html', templates=list(SAMPLE_TEMPLATES.keys()))


@app.route('/get_template/<name>')
def get_template(name):
    if name in SAMPLE_TEMPLATES:
        return jsonify({'success': True, 'code': SAMPLE_TEMPLATES[name]})
    return jsonify({'success': False, 'error': 'Template not found'})


@app.route('/compile', methods=['POST'])
def compile_pdf():
    latex_code = request.json.get('latex_code', '')
    
    if not latex_code.strip():
        return jsonify({'success': False, 'error': 'No LaTeX code provided'})
    
    success, message, pdf_path = compile_latex(latex_code)
    
    if success and pdf_path:
        job_id = os.path.basename(os.path.dirname(pdf_path))
        return jsonify({
            'success': True, 
            'message': message,
            'pdf_url': f'/pdf/{job_id}'
        })
    else:
        return jsonify({'success': False, 'error': message})


@app.route('/pdf/<job_id>')
def serve_pdf(job_id):
    pdf_path = os.path.join(TEMP_DIR, job_id, 'resume.pdf')
    if os.path.exists(pdf_path):
        return send_file(pdf_path, mimetype='application/pdf')
    return "PDF not found", 404


@app.route('/chat', methods=['POST'])
def chat():
    """Handle chat messages and generate LaTeX."""
    message = request.form.get('message', '')
    pdf_file = request.files.get('pdf')
    current_latex = request.form.get('current_latex', '')
    
    user_input = message
    pdf_text = ""
    
    # If PDF uploaded, extract text
    if pdf_file and pdf_file.filename:
        pdf_text = extract_text_from_pdf(pdf_file)
        user_input = f"Resume content from PDF:\n{pdf_text}\n\nUser request: {message}" if message else f"Create a LaTeX resume from this content:\n{pdf_text}"
    
    if not user_input.strip():
        return jsonify({'success': False, 'error': 'Please provide some input'})
    
    # Validate and categorize the request
    request_type, error_message = validate_request(user_input)
    
    if request_type == "invalid":
        return jsonify({'success': False, 'error': error_message, 'is_chat_response': True})
    
    if request_type == "question":
        # User is asking for advice - respond conversationally with full context
        context = current_latex if current_latex else "No resume loaded yet. Please create or upload a resume first."
        advice = get_advice_response(message, context)
        return jsonify({'success': False, 'error': advice, 'is_chat_response': True})
    
    # request_type == "generate" - create/modify resume
    if current_latex and message and not pdf_file:
        user_input = f"Current LaTeX code:\n{current_latex}\n\nModification request: {message}"
    
    latex_code = generate_latex_with_gemini(user_input, is_modification=bool(current_latex and not pdf_file))
    
    if latex_code.startswith('Error'):
        return jsonify({'success': False, 'error': latex_code})
    
    return jsonify({'success': True, 'latex_code': latex_code})


if __name__ == '__main__':
    app.run(debug=True, port=5050)
