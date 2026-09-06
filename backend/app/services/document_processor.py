from io import BytesIO
from pathlib import Path

import fitz
import pytesseract
from PIL import Image
from pypdf import PdfReader


class DocumentProcessor:
    def __init__(self):
        self._configure_tesseract()

    def _configure_tesseract(
        self,
    ) -> None:
        windows_paths = [
            Path(
                r"C:\Program Files\Tesseract-OCR\tesseract.exe"
            ),
            Path(
                r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe"
            ),
        ]

        for path in windows_paths:
            if path.exists():
                pytesseract.pytesseract.tesseract_cmd = str(
                    path
                )
                break

    def clean_text(
        self,
        text: str,
    ) -> str:
        lines = [
            line.strip()
            for line in text.splitlines()
        ]

        cleaned_lines = [
            line
            for line in lines
            if line
        ]

        return "\n".join(
            cleaned_lines
        ).strip()

    def ocr_image(
        self,
        image: Image.Image,
    ) -> str:
        if image.mode not in {
            "RGB",
            "L",
        }:
            image = image.convert(
                "RGB"
            )

        text = pytesseract.image_to_string(
            image,
            config="--psm 6",
        )

        return self.clean_text(
            text
        )

    def extract_image_text(
        self,
        file_bytes: bytes,
    ) -> list[dict]:
        image = Image.open(
            BytesIO(file_bytes)
        )

        image.load()

        text = self.ocr_image(
            image
        )

        if not text:
            return []

        return [
            {
                "page_number": 1,
                "text": text,
                "extraction_method": "ocr",
            }
        ]

    def _ocr_pdf_page(
        self,
        pdf_document,
        page_index: int,
    ) -> str:
        page = pdf_document.load_page(
            page_index
        )

        matrix = fitz.Matrix(
            2.0,
            2.0,
        )

        pixmap = page.get_pixmap(
            matrix=matrix,
            alpha=False,
        )

        image = Image.frombytes(
            "RGB",
            [
                pixmap.width,
                pixmap.height,
            ],
            pixmap.samples,
        )

        return self.ocr_image(
            image
        )

    def extract_pdf_pages(
        self,
        file_bytes: bytes,
    ) -> list[dict]:
        reader = PdfReader(
            BytesIO(file_bytes)
        )

        pdf_document = fitz.open(
            stream=file_bytes,
            filetype="pdf",
        )

        pages = []

        try:
            for page_index, page in enumerate(
                reader.pages
            ):
                page_number = (
                    page_index + 1
                )

                direct_text = (
                    page.extract_text()
                    or ""
                )

                direct_text = (
                    self.clean_text(
                        direct_text
                    )
                )

                extraction_method = (
                    "text"
                )

                if len(
                    direct_text
                ) < 40:
                    ocr_text = (
                        self._ocr_pdf_page(
                            pdf_document,
                            page_index,
                        )
                    )

                    if len(
                        ocr_text
                    ) > len(
                        direct_text
                    ):
                        direct_text = (
                            ocr_text
                        )

                        extraction_method = (
                            "ocr"
                        )

                if direct_text:
                    pages.append(
                        {
                            "page_number": page_number,
                            "text": direct_text,
                            "extraction_method": extraction_method,
                        }
                    )

        finally:
            pdf_document.close()

        return pages


document_processor = DocumentProcessor()