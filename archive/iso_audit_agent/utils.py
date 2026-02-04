import PyPDF2
import docx

def extract_text_from_pdf(file):
    """Extracts text from a PDF file object."""
    pdf_reader = PyPDF2.PdfReader(file)
    text = ""
    for page in pdf_reader.pages:
        text += page.extract_text() or ""
    return text

def extract_text_from_docx(file):
    """Extracts text from a DOCX file object."""
    doc = docx.Document(file)
    text = ""
    for para in doc.paragraphs:
        text += para.text + "\n"
    return text
