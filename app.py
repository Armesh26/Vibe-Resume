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
import requests
from bs4 import BeautifulSoup
import re
import json
from datetime import datetime

load_dotenv()

app = Flask(__name__)

# Configure Gemini
genai.configure(api_key=os.getenv('GEMINI_API_KEY'))
model_pro = genai.GenerativeModel('gemini-3-pro-preview')
model_fast = genai.GenerativeModel('gemini-2.5-flash')

def get_model(pro_mode: bool = False):
    """Get the appropriate model based on mode."""
    return model_pro if pro_mode else model_fast

# Store generated PDFs temporarily - normalize path to avoid double slashes
TEMP_DIR = os.path.normpath(os.path.join(tempfile.gettempdir(), 'latex_resumes'))
os.makedirs(TEMP_DIR, exist_ok=True)

# Chat history directory - store each chat by ID
CHAT_HISTORY_DIR = os.path.join(os.path.dirname(__file__), 'chat_histories')
os.makedirs(CHAT_HISTORY_DIR, exist_ok=True)


def get_chat_file_path(chat_id: str) -> str:
    """Get the file path for a specific chat ID."""
    # Sanitize chat_id to prevent directory traversal
    safe_id = re.sub(r'[^a-zA-Z0-9_-]', '', chat_id)
    return os.path.join(CHAT_HISTORY_DIR, f'{safe_id}.json')


def load_chat_history(chat_id: str = None):
    """Load chat history from file."""
    try:
        if chat_id:
            file_path = get_chat_file_path(chat_id)
            if os.path.exists(file_path):
                with open(file_path, 'r') as f:
                    return json.load(f)
    except Exception:
        pass
    return {'messages': [], 'latex': '', 'checkpoints': []}


def save_chat_history(data, chat_id: str = None):
    """Save chat history to file."""
    if not chat_id:
        return  # Don't save without a chat ID
    try:
        file_path = get_chat_file_path(chat_id)
        with open(file_path, 'w') as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        print(f"Error saving chat history: {e}")

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

\hypersetup{colorlinks=true, urlcolor=accent, pdfnewwindow=true}

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
\\hypersetup{colorlinks=true, urlcolor=darkblue, linkcolor=darkblue, pdfnewwindow=true}

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
                [pdflatex_path, '-synctex=1', '-interaction=nonstopmode', '-output-directory', job_dir, tex_file],
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


def extract_url_from_text(text: str) -> Optional[str]:
    """Extract URL from text."""
    url_pattern = r'https?://[^\s<>"{}|\\^`\[\]]+'
    match = re.search(url_pattern, text)
    return match.group(0) if match else None


def is_linkedin_url(url: str) -> bool:
    """Check if URL is a LinkedIn profile."""
    return 'linkedin.com/in/' in url.lower()


def is_twitter_url(url: str) -> bool:
    """Check if URL is a Twitter/X profile."""
    return 'twitter.com/' in url.lower() or 'x.com/' in url.lower()


def scrape_linkedin_profile(url: str) -> str:
    """Attempt to scrape LinkedIn profile. Returns extracted info or error."""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
        }
        
        response = requests.get(url, headers=headers, timeout=10)
        
        if response.status_code != 200:
            return f"Could not access LinkedIn profile (status {response.status_code}). LinkedIn requires authentication for most profiles. Please copy and paste your profile information directly."
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Try to extract public profile data
        content_parts = []
        
        # Get title/name
        title = soup.find('title')
        if title:
            content_parts.append(f"Profile: {title.text}")
        
        # Get meta description
        meta_desc = soup.find('meta', {'name': 'description'})
        if meta_desc and meta_desc.get('content'):
            content_parts.append(f"Summary: {meta_desc['content']}")
        
        # Get any visible text content
        for tag in soup.find_all(['h1', 'h2', 'h3', 'p', 'span', 'li']):
            text = tag.get_text(strip=True)
            if text and len(text) > 10 and len(text) < 500:
                content_parts.append(text)
        
        if content_parts:
            return "\n".join(content_parts[:50])  # Limit content
        else:
            return "Could not extract LinkedIn profile data. LinkedIn blocks automated access. Please copy and paste your profile information (About, Experience, Education, Skills) directly into the chat."
            
    except Exception as e:
        return f"Error accessing LinkedIn: {str(e)}. Please copy and paste your profile information directly."


def scrape_twitter_profile(url: str) -> str:
    """Attempt to scrape Twitter/X profile. Returns extracted info or error."""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        }
        
        response = requests.get(url, headers=headers, timeout=10)
        
        if response.status_code != 200:
            return f"Could not access Twitter profile. Please copy and paste your bio and relevant tweets."
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        content_parts = []
        
        # Get title
        title = soup.find('title')
        if title:
            content_parts.append(f"Profile: {title.text}")
        
        # Get meta description (usually contains bio)
        meta_desc = soup.find('meta', {'name': 'description'})
        if meta_desc and meta_desc.get('content'):
            content_parts.append(f"Bio: {meta_desc['content']}")
        
        # Try og:description
        og_desc = soup.find('meta', {'property': 'og:description'})
        if og_desc and og_desc.get('content'):
            content_parts.append(f"About: {og_desc['content']}")
        
        if content_parts:
            return "\n".join(content_parts)
        else:
            return "Could not extract Twitter profile data. Twitter/X requires authentication. Please copy and paste your bio and any relevant information directly."
            
    except Exception as e:
        return f"Error accessing Twitter: {str(e)}. Please copy and paste your profile information directly."


def scrape_url(url: str) -> str:
    """Scrape content from a URL."""
    if is_linkedin_url(url):
        return scrape_linkedin_profile(url)
    elif is_twitter_url(url):
        return scrape_twitter_profile(url)
    else:
        # Generic URL scraping
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            }
            response = requests.get(url, headers=headers, timeout=10)
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Remove scripts and styles
            for tag in soup(['script', 'style', 'nav', 'footer', 'header']):
                tag.decompose()
            
            text = soup.get_text(separator='\n', strip=True)
            # Clean up whitespace
            lines = [line.strip() for line in text.split('\n') if line.strip()]
            return '\n'.join(lines[:100])  # Limit content
            
        except Exception as e:
            return f"Error fetching URL: {str(e)}"


def is_image_file(filename: str) -> bool:
    """Check if file is an image based on extension."""
    image_extensions = {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'}
    ext = os.path.splitext(filename.lower())[1]
    return ext in image_extensions


def process_image_with_gemini(image_file, message: str = "", pro_mode: bool = False) -> str:
    """Process image with Gemini vision and extract resume content."""
    try:
        import base64
        
        # Read image data
        image_data = image_file.read()
        
        # Determine mime type
        filename = image_file.filename.lower()
        if filename.endswith('.png'):
            mime_type = 'image/png'
        elif filename.endswith('.gif'):
            mime_type = 'image/gif'
        elif filename.endswith('.webp'):
            mime_type = 'image/webp'
        else:
            mime_type = 'image/jpeg'
        
        # Create image part for Gemini
        image_part = {
            "mime_type": mime_type,
            "data": base64.b64encode(image_data).decode('utf-8')
        }
        
        prompt = """Analyze this resume image and extract ALL the information you can see.
        
Include:
- Full name and contact details
- Education (degrees, institutions, dates, GPA if shown)
- Work experience (companies, roles, dates, responsibilities)
- Skills (technical and soft skills)
- Projects (if any)
- Certifications, awards, or other sections

Format the output as plain text that can be used to recreate this resume."""

        if message:
            prompt += f"\n\nAdditional user request: {message}"
        
        model = get_model(pro_mode)
        response = model.generate_content(
            [prompt, image_part],
            generation_config=genai.types.GenerationConfig(temperature=0.2)
        )
        
        return response.text.strip()
        
    except Exception as e:
        return f"Error processing image: {str(e)}"


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


def validate_request(user_input: str, pro_mode: bool = False) -> tuple:
    """Check request type. Returns (request_type, message)."""
    try:
        model = get_model(pro_mode)
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


def get_advice_response(question: str, context: str = "", pro_mode: bool = False) -> str:
    """Get conversational advice about resume content."""
    try:
        prompt = ADVICE_PROMPT.format(context=context or "No resume loaded yet", question=question)
        model = get_model(pro_mode)
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(temperature=0.7)
        )
        return response.text.strip()
    except Exception as e:
        return f"I'd be happy to help with that! Could you provide more details about what you'd like to change?"


def generate_latex_with_gemini(user_input: str, is_modification: bool = False, pro_mode: bool = False) -> str:
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
        
        model = get_model(pro_mode)
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
    uploaded_file = request.files.get('pdf')
    current_latex = request.form.get('current_latex', '')
    pro_mode = request.form.get('pro_mode', 'false').lower() == 'true'
    
    user_input = message
    file_content = ""
    
    # Check for URLs in message (LinkedIn, Twitter, etc.)
    url = extract_url_from_text(message)
    if url:
        scraped_content = scrape_url(url)
        if is_linkedin_url(url):
            user_input = f"LinkedIn profile content:\n{scraped_content}\n\nUser request: {message}"
        elif is_twitter_url(url):
            user_input = f"Twitter/X profile content:\n{scraped_content}\n\nUser request: {message}"
        else:
            user_input = f"Web page content:\n{scraped_content}\n\nUser request: {message}"
    
    # If file uploaded, process based on type
    if uploaded_file and uploaded_file.filename:
        if is_image_file(uploaded_file.filename):
            # Process image with Gemini vision
            file_content = process_image_with_gemini(uploaded_file, message, pro_mode)
            user_input = f"Resume content from image:\n{file_content}\n\nUser request: {message}" if message else f"Create a LaTeX resume from this content:\n{file_content}"
        else:
            # Process PDF
            file_content = extract_text_from_pdf(uploaded_file)
            user_input = f"Resume content from PDF:\n{file_content}\n\nUser request: {message}" if message else f"Create a LaTeX resume from this content:\n{file_content}"
    
    if not user_input.strip():
        return jsonify({'success': False, 'error': 'Please provide some input'})
    
    # Skip validation if file was uploaded or URL provided - assume it's resume-related
    if (uploaded_file and uploaded_file.filename) or url:
        request_type = "generate"
        error_message = None
    else:
        # Validate and categorize the request
        request_type, error_message = validate_request(user_input, pro_mode)
    
    if request_type == "invalid":
        return jsonify({'success': False, 'error': error_message, 'is_chat_response': True})
    
    if request_type == "question":
        # User is asking for advice - respond conversationally with full context
        context = current_latex if current_latex else "No resume loaded yet. Please create or upload a resume first."
        advice = get_advice_response(message, context, pro_mode)
        return jsonify({'success': False, 'error': advice, 'is_chat_response': True})
    
    # request_type == "generate" - create/modify resume
    if current_latex and message and not uploaded_file:
        user_input = f"Current LaTeX code:\n{current_latex}\n\nModification request: {message}"
    
    latex_code = generate_latex_with_gemini(user_input, is_modification=bool(current_latex and not uploaded_file), pro_mode=pro_mode)
    
    if latex_code.startswith('Error'):
        return jsonify({'success': False, 'error': latex_code})
    
    return jsonify({'success': True, 'latex_code': latex_code})


@app.route('/history', methods=['GET'])
def get_history():
    """Get chat history for a specific session."""
    session_id = request.args.get('sessionId')
    history = load_chat_history(session_id)
    return jsonify(history)


@app.route('/history', methods=['POST'])
def update_history():
    """Update chat history for a specific session."""
    data = request.json
    session_id = data.get('sessionId')
    if session_id:
        # Remove sessionId from data before saving
        history_data = {k: v for k, v in data.items() if k != 'sessionId'}
        save_chat_history(history_data, session_id)
    return jsonify({'success': True})


@app.route('/history/clear', methods=['POST'])
def clear_history():
    """Clear chat history for a specific session."""
    data = request.json or {}
    session_id = data.get('sessionId')
    save_chat_history({'messages': [], 'latex': '', 'checkpoints': []}, session_id)
    return jsonify({'success': True})


def find_synctex() -> Optional[str]:
    """Find synctex executable."""
    if shutil.which('synctex'):
        return 'synctex'
    
    common_paths = [
        '/Library/TeX/texbin/synctex',
        '/usr/local/texlive/2024/bin/universal-darwin/synctex',
        '/usr/local/texlive/2025/bin/universal-darwin/synctex',
        '/usr/bin/synctex',
        '/usr/local/bin/synctex',
    ]
    
    for path in common_paths:
        if os.path.isfile(path) and os.access(path, os.X_OK):
            return path
    
    return None


@app.route('/synctex/forward/<job_id>', methods=['POST'])
def synctex_forward(job_id):
    """Forward sync: line number -> PDF position."""
    data = request.json
    line = data.get('line', 1)
    
    job_dir = os.path.normpath(os.path.join(TEMP_DIR, job_id))
    synctex_file = os.path.join(job_dir, 'resume.synctex.gz')
    tex_file = os.path.normpath(os.path.join(job_dir, 'resume.tex'))
    pdf_file = os.path.normpath(os.path.join(job_dir, 'resume.pdf'))
    
    synctex_path = find_synctex()
    if not synctex_path:
        return jsonify({'success': False, 'error': 'SyncTeX not found'})
    
    if not os.path.exists(synctex_file):
        return jsonify({'success': False, 'error': 'SyncTeX file not found'})
    
    try:
        # Use synctex command-line tool with normalized paths
        result = subprocess.run(
            [synctex_path, 'view', '-i', f'{line}:0:{tex_file}', '-o', pdf_file],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        # Parse output to get page, x, y, w, h (take first result)
        output = result.stdout
        page = 1
        x, y, w, h = 0, 0, 0, 0
        found_result = False
        
        for line_out in output.split('\n'):
            line_out = line_out.strip()
            if line_out.startswith('Page:'):
                if not found_result:  # Take first result only
                    page = int(line_out.split(':')[1].strip())
                    found_result = True
            elif line_out.startswith('x:') and found_result:
                x = float(line_out.split(':')[1].strip())
            elif line_out.startswith('y:') and found_result:
                y = float(line_out.split(':')[1].strip())
            elif line_out.startswith('W:') and found_result:
                w = float(line_out.split(':')[1].strip())
            elif line_out.startswith('H:') and found_result:
                h = float(line_out.split(':')[1].strip())
                break  # Got all values for first result
        
        if not found_result:
            return jsonify({'success': False, 'error': 'No sync result found'})
        
        return jsonify({
            'success': True,
            'page': page,
            'x': x,
            'y': y,
            'width': w,
            'height': h
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


@app.route('/synctex/reverse/<job_id>', methods=['POST'])
def synctex_reverse(job_id):
    """Reverse sync: PDF position -> line number."""
    data = request.json
    page = data.get('page', 1)
    x = data.get('x', 0)
    y = data.get('y', 0)
    
    job_dir = os.path.normpath(os.path.join(TEMP_DIR, job_id))
    pdf_file = os.path.normpath(os.path.join(job_dir, 'resume.pdf'))
    
    synctex_path = find_synctex()
    if not synctex_path:
        return jsonify({'success': False, 'error': 'SyncTeX not found'})
    
    if not os.path.exists(pdf_file):
        return jsonify({'success': False, 'error': 'PDF file not found'})
    
    try:
        # Use synctex command-line tool
        result = subprocess.run(
            [synctex_path, 'edit', '-o', f'{page}:{x}:{y}:{pdf_file}'],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        # Parse output to get line number
        output = result.stdout
        line = 0
        
        for line_out in output.split('\n'):
            line_out = line_out.strip()
            if line_out.startswith('Line:'):
                line = int(line_out.split(':')[1].strip())
                break
        
        if line == 0:
            return jsonify({'success': False, 'error': 'No line found'})
        
        return jsonify({
            'success': True,
            'line': line
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


if __name__ == '__main__':
    app.run(debug=True, port=5050)
