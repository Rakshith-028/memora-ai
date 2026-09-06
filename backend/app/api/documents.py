import hashlib
import re
import uuid

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    UploadFile,
    status,
)
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.models.document import Document
from app.models.document_chunk import DocumentChunk
from app.models.user import User
from app.services.document_processor import document_processor
from app.services.document_search import document_search_service
from app.services.embeddings import embedding_service


router = APIRouter(
    prefix="/documents",
    tags=["Documents"],
)


MAX_FILE_SIZE = 20 * 1024 * 1024

SUPPORTED_IMAGE_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
}

SUPPORTED_IMAGE_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
}


class DocumentSearchRequest(BaseModel):
    query: str = Field(
        min_length=1,
        max_length=2000,
    )

    limit: int = Field(
        default=5,
        ge=1,
        le=10,
    )

    document_id: uuid.UUID | None = None


def calculate_file_hash(
    file_bytes: bytes,
) -> str:
    return hashlib.sha256(
        file_bytes
    ).hexdigest()


def split_into_sentences(
    text: str,
) -> list[str]:
    cleaned = re.sub(
        r"\s+",
        " ",
        text,
    ).strip()

    if not cleaned:
        return []

    sentences = re.split(
        r"(?<=[.!?])\s+",
        cleaned,
    )

    return [
        sentence.strip()
        for sentence in sentences
        if sentence.strip()
    ]


def chunk_text(
    text: str,
    chunk_size: int = 900,
    overlap_sentences: int = 1,
) -> list[str]:
    text = text.strip()

    if not text:
        return []

    paragraphs = [
        paragraph.strip()
        for paragraph in re.split(
            r"\n\s*\n",
            text,
        )
        if paragraph.strip()
    ]

    chunks = []
    current_sentences = []
    current_length = 0

    for paragraph in paragraphs:
        sentences = split_into_sentences(
            paragraph
        )

        if not sentences:
            continue

        for sentence in sentences:
            sentence_length = len(
                sentence
            )

            if (
                current_sentences
                and current_length
                + sentence_length
                + 1
                > chunk_size
            ):
                chunk = " ".join(
                    current_sentences
                ).strip()

                if chunk:
                    chunks.append(
                        chunk
                    )

                overlap = (
                    current_sentences[
                        -overlap_sentences:
                    ]
                    if overlap_sentences > 0
                    else []
                )

                current_sentences = (
                    overlap.copy()
                )

                current_length = sum(
                    len(item)
                    for item in current_sentences
                )

            current_sentences.append(
                sentence
            )

            current_length += (
                sentence_length + 1
            )

    if current_sentences:
        chunk = " ".join(
            current_sentences
        ).strip()

        if chunk:
            chunks.append(
                chunk
            )

    return chunks


@router.post(
    "/upload",
    status_code=status.HTTP_201_CREATED,
)
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    ),
):
    filename = (
        file.filename
        or "document"
    )

    filename_lower = (
        filename.lower()
    )

    is_pdf = (
        file.content_type
        == "application/pdf"
        or filename_lower.endswith(
            ".pdf"
        )
    )

    is_image = (
        file.content_type
        in SUPPORTED_IMAGE_CONTENT_TYPES
        or any(
            filename_lower.endswith(
                extension
            )
            for extension
            in SUPPORTED_IMAGE_EXTENSIONS
        )
    )

    if not (
        is_pdf
        or is_image
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Supported files are PDF, "
                "JPG, JPEG, PNG, and WEBP."
            ),
        )

    file_bytes = await file.read()

    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Uploaded file is empty."
            ),
        )

    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=(
                "File is too large. "
                "Maximum size is 20 MB."
            ),
        )

    file_hash = calculate_file_hash(
        file_bytes
    )

    existing_document = db.scalar(
        select(Document).where(
            Document.user_id
            == current_user.id,
            Document.file_hash
            == file_hash,
        )
    )

    if existing_document is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": (
                    "This document has already "
                    "been uploaded."
                ),
                "document_id": str(
                    existing_document.id
                ),
                "filename": (
                    existing_document.filename
                ),
                "status": (
                    existing_document.status
                ),
            },
        )

    try:
        if is_pdf:
            pages = (
                document_processor
                .extract_pdf_pages(
                    file_bytes
                )
            )

        else:
            pages = (
                document_processor
                .extract_image_text(
                    file_bytes
                )
            )

    except Exception as exc:
        print(
            "DOCUMENT EXTRACTION ERROR:",
            exc,
        )

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Unable to extract text "
                "from the uploaded file."
            ),
        )

    if not pages:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "No readable text was found "
                "in the uploaded file."
            ),
        )

    full_text = "\n\n".join(
        page["text"]
        for page in pages
    )

    document = Document(
        user_id=current_user.id,
        filename=filename,
        content_type=file.content_type,
        file_hash=file_hash,
        status="processing",
        extracted_text=full_text,
    )

    db.add(
        document
    )

    try:
        db.flush()

    except IntegrityError:
        db.rollback()

        duplicate_document = db.scalar(
            select(Document).where(
                Document.user_id
                == current_user.id,
                Document.file_hash
                == file_hash,
            )
        )

        detail = {
            "message": (
                "This document has already "
                "been uploaded."
            )
        }

        if duplicate_document is not None:
            detail[
                "document_id"
            ] = str(
                duplicate_document.id
            )

            detail[
                "filename"
            ] = (
                duplicate_document.filename
            )

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=detail,
        )

    chunk_index = 0

    try:
        for page in pages:
            page_number = (
                page["page_number"]
            )

            page_chunks = chunk_text(
                page["text"]
            )

            for chunk in page_chunks:
                embedding = (
                    embedding_service.embed(
                        chunk
                    )
                )

                document_chunk = (
                    DocumentChunk(
                        document_id=document.id,
                        chunk_index=chunk_index,
                        page_number=page_number,
                        content=chunk,
                        embedding=embedding,
                    )
                )

                db.add(
                    document_chunk
                )

                chunk_index += 1

        if chunk_index == 0:
            raise ValueError(
                "No chunks were generated."
            )

        document.status = "ready"

        db.commit()
        db.refresh(
            document
        )

    except HTTPException:
        raise

    except Exception as exc:
        db.rollback()

        print(
            "DOCUMENT PROCESSING "
            f"ERROR: {exc}"
        )

        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                "Document processing "
                "failed."
            ),
        )

    extraction_methods = sorted(
        {
            page.get(
                "extraction_method",
                "unknown",
            )
            for page in pages
        }
    )

    return {
        "id": str(
            document.id
        ),
        "filename": (
            document.filename
        ),
        "content_type": (
            document.content_type
        ),
        "status": (
            document.status
        ),
        "pages_processed": len(
            pages
        ),
        "chunks_created": (
            chunk_index
        ),
        "extraction_methods": (
            extraction_methods
        ),
        "created_at": (
            document.created_at
        ),
    }


@router.post(
    "/search"
)
def search_documents(
    payload: DocumentSearchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    ),
):
    if payload.document_id is not None:
        document = db.scalar(
            select(Document).where(
                Document.id
                == payload.document_id,
                Document.user_id
                == current_user.id,
            )
        )

        if document is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=(
                    "Document not found."
                ),
            )

    matches = (
        document_search_service.search(
            db=db,
            user=current_user,
            query=payload.query,
            limit=payload.limit,
            document_id=payload.document_id,
        )
    )

    return {
        "query": payload.query,
        "matches": matches,
    }


@router.delete(
    "/{document_id}",
    status_code=status.HTTP_200_OK,
)
def delete_document(
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    ),
):
    document = db.scalar(
        select(Document).where(
            Document.id
            == document_id,
            Document.user_id
            == current_user.id,
        )
    )

    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "Document not found."
            ),
        )

    db.execute(
        delete(
            DocumentChunk
        ).where(
            DocumentChunk.document_id
            == document.id
        )
    )

    db.delete(
        document
    )

    db.commit()

    return {
        "status": "deleted",
        "document_id": str(
            document_id
        ),
        "filename": (
            document.filename
        ),
    }


@router.get("")
def list_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    ),
):
    documents = db.scalars(
        select(Document)
        .where(
            Document.user_id
            == current_user.id
        )
        .order_by(
            Document.created_at.desc()
        )
    ).all()

    return [
        {
            "id": str(
                document.id
            ),
            "filename": (
                document.filename
            ),
            "content_type": (
                document.content_type
            ),
            "status": (
                document.status
            ),
            "created_at": (
                document.created_at
            ),
        }
        for document in documents
    ]