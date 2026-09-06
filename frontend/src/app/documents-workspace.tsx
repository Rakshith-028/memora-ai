"use client";

import {
  AlertCircle,
  CheckCircle2,
  FileImage,
  FileText,
  HardDrive,
  LoaderCircle,
  ScanText,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import {
  ChangeEvent,
  DragEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type DocumentRecord = {
  id: string;
  filename: string;
  content_type: string | null;
  status: string;
  created_at: string;
};

type UploadResult = {
  id: string;
  filename: string;
  content_type: string | null;
  status: string;
  pages_processed: number;
  chunks_created: number;
  extraction_methods: string[];
  created_at: string;
};

const MAX_FILE_SIZE = 20 * 1024 * 1024;

const ACCEPTED_EXTENSIONS = [
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
];

function getErrorMessage(
  data: unknown,
  fallback: string
) {
  if (
    typeof data === "object" &&
    data !== null &&
    "detail" in data
  ) {
    const detail = (
      data as {
        detail?: unknown;
      }
    ).detail;

    if (typeof detail === "string") {
      return detail;
    }

    if (
      typeof detail === "object" &&
      detail !== null &&
      "message" in detail
    ) {
      const message = (
        detail as {
          message?: unknown;
        }
      ).message;

      if (typeof message === "string") {
        return message;
      }
    }
  }

  return fallback;
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat(
    "en",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  ).format(date);
}

function isImageDocument(
  document: DocumentRecord
) {
  return (
    document.content_type?.startsWith(
      "image/"
    ) ?? false
  );
}

export default function DocumentsWorkspace() {
  const router = useRouter();

  const fileInputRef =
    useRef<HTMLInputElement | null>(null);

  const [documents, setDocuments] =
    useState<DocumentRecord[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [uploading, setUploading] =
    useState(false);

  const [deletingId, setDeletingId] =
    useState<string | null>(null);

  const [dragActive, setDragActive] =
    useState(false);

  const [query, setQuery] =
    useState("");

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  useEffect(() => {
    let active = true;

    async function loadInitialDocuments() {
      try {
        const response = await fetch(
          "/api/documents",
          {
            method: "GET",
            cache: "no-store",
          }
        );

        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            getErrorMessage(
              data,
              "Unable to load documents."
            )
          );
        }

        if (active) {
          setDocuments(
            Array.isArray(data)
              ? data
              : []
          );
        }
      } catch (caughtError) {
        if (active) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to load documents."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadInitialDocuments();

    return () => {
      active = false;
    };
  }, [router]);

  async function refreshDocuments() {
    try {
      const response = await fetch(
        "/api/documents",
        {
          method: "GET",
          cache: "no-store",
        }
      );

      if (response.status === 401) {
        router.replace("/login");
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            data,
            "Unable to load documents."
          )
        );
      }

      setDocuments(
        Array.isArray(data)
          ? data
          : []
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load documents."
      );
    }
  }

  function validateFile(file: File) {
    const lowerName =
      file.name.toLowerCase();

    const supported =
      ACCEPTED_EXTENSIONS.some(
        (extension) =>
          lowerName.endsWith(extension)
      );

    if (!supported) {
      return (
        "Supported files are PDF, JPG, " +
        "JPEG, PNG, and WEBP."
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return (
        "File is too large. " +
        "Maximum size is 20 MB."
      );
    }

    return "";
  }

  async function uploadFile(file: File) {
    if (uploading) {
      return;
    }

    setError("");
    setSuccess("");

    const validationError =
      validateFile(file);

    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setUploading(true);

      const formData =
        new FormData();

      formData.append(
        "file",
        file
      );

      const response = await fetch(
        "/api/documents",
        {
          method: "POST",
          body: formData,
        }
      );

      if (response.status === 401) {
        router.replace("/login");
        return;
      }

      const data = await response.json();

      if (response.status === 409) {
        setError(
          getErrorMessage(
            data,
            "This document has already been uploaded."
          )
        );
        return;
      }

      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            data,
            "Unable to upload document."
          )
        );
      }

      const result =
        data as UploadResult;

      const methodLabel =
        result.extraction_methods
          ?.map((method) =>
            method.toUpperCase()
          )
          .join(" + ") || "READY";

      setSuccess(
        `${result.filename} processed successfully · ` +
          `${result.pages_processed} page${
            result.pages_processed === 1
              ? ""
              : "s"
          } · ${methodLabel}`
      );

      await refreshDocuments();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to upload document."
      );
    } finally {
      setUploading(false);

      if (fileInputRef.current) {
        fileInputRef.current.value =
          "";
      }
    }
  }

  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    if (file) {
      void uploadFile(file);
    }
  }

  function handleDragOver(
    event: DragEvent<HTMLDivElement>
  ) {
    event.preventDefault();
    setDragActive(true);
  }

  function handleDragLeave(
    event: DragEvent<HTMLDivElement>
  ) {
    event.preventDefault();
    setDragActive(false);
  }

  function handleDrop(
    event: DragEvent<HTMLDivElement>
  ) {
    event.preventDefault();
    setDragActive(false);

    const file =
      event.dataTransfer.files?.[0];

    if (file) {
      void uploadFile(file);
    }
  }

  async function deleteDocument(
    document: DocumentRecord
  ) {
    const shouldDelete =
      window.confirm(
        `Delete "${document.filename}"? ` +
          "Its indexed chunks will also be removed."
      );

    if (!shouldDelete) {
      return;
    }

    setError("");
    setSuccess("");

    try {
      setDeletingId(document.id);

      const response = await fetch(
        `/api/documents/${document.id}`,
        {
          method: "DELETE",
        }
      );

      if (response.status === 401) {
        router.replace("/login");
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            data,
            "Unable to delete document."
          )
        );
      }

      setDocuments((current) =>
        current.filter(
          (item) =>
            item.id !== document.id
        )
      );

      setSuccess(
        `${document.filename} deleted.`
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to delete document."
      );
    } finally {
      setDeletingId(null);
    }
  }

  const filteredDocuments =
    documents.filter((document) =>
      document.filename
        .toLowerCase()
        .includes(
          query.trim().toLowerCase()
        )
    );

  return (
    <section className="workspace min-w-0">
      <header className="topbar">
        <div className="conversation-title">
          <div>
            <span className="eyebrow">
              Knowledge
            </span>

            <h1>
              Document intelligence
            </h1>
          </div>

          <div className="ml-2 flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.025] px-2.5 py-1.5 text-[9px] text-white/35">
            <ScanText
              size={13}
              className="text-violet-300/65"
            />
            OCR + RAG ready
          </div>
        </div>

        <div className="topbar-actions">
          <div className="privacy-pill">
            <ShieldCheck size={15} />
            User isolated
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1120px] px-6 py-8 lg:px-8">
          <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-300/60">
                <Sparkles size={13} />
                Knowledge library
              </div>

              <h2 className="max-w-[680px] text-[30px] font-medium leading-[1.12] tracking-[-0.045em] text-white/95">
                Give Memora knowledge it can
                <span className="bg-gradient-to-r from-violet-300 to-sky-300 bg-clip-text text-transparent">
                  {" "}
                  actually retrieve.
                </span>
              </h2>

              <p className="mt-3 max-w-[620px] text-[11px] leading-6 text-white/35">
                Upload text PDFs, scanned PDFs, or images.
                Memora extracts text, creates semantic chunks,
                and makes the content available to cited answers.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3">
                <div className="text-[8px] uppercase tracking-[0.12em] text-white/25">
                  Indexed
                </div>

                <div className="mt-1 text-[18px] font-medium tracking-[-0.04em] text-white/80">
                  {documents.length}
                </div>
              </div>

              <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3">
                <div className="text-[8px] uppercase tracking-[0.12em] text-white/25">
                  Pipeline
                </div>

                <div className="mt-1 flex items-center gap-1.5 text-[10px] font-medium text-emerald-300/70">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300/70" />
                  Ready
                </div>
              </div>
            </div>
          </div>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative overflow-hidden rounded-2xl border border-dashed px-6 py-8 transition ${
              dragActive
                ? "border-violet-300/40 bg-violet-400/[0.065]"
                : "border-white/[0.10] bg-white/[0.018]"
            }`}
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-30%,rgba(139,116,232,0.12),transparent_48%)]" />

            <div className="relative flex flex-col items-center text-center">
              <div className="grid h-12 w-12 place-items-center rounded-2xl border border-violet-300/15 bg-violet-400/[0.07] text-violet-300/75">
                {uploading ? (
                  <LoaderCircle
                    size={21}
                    className="animate-spin"
                  />
                ) : (
                  <UploadCloud size={21} />
                )}
              </div>

              <h3 className="mt-4 text-[13px] font-medium text-white/78">
                {uploading
                  ? "Memora is processing your document"
                  : "Drop a document into Memora"}
              </h3>

              <p className="mt-2 text-[9px] leading-5 text-white/28">
                PDF, JPG, JPEG, PNG or WEBP · Up to 20 MB
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="hidden"
              />

              <button
                type="button"
                disabled={uploading}
                onClick={() =>
                  fileInputRef.current?.click()
                }
                className="mt-5 inline-flex h-9 items-center gap-2 rounded-lg border border-violet-300/15 bg-violet-400/[0.07] px-4 text-[10px] font-medium text-violet-100/75 transition hover:border-violet-300/25 hover:bg-violet-400/[0.11] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <UploadCloud size={14} />
                {uploading
                  ? "Processing..."
                  : "Choose file"}
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-400/15 bg-red-400/[0.045] px-4 py-3 text-[10px] leading-5 text-red-200/70">
              <AlertCircle
                size={15}
                className="mt-0.5 shrink-0"
              />

              <span className="flex-1">
                {error}
              </span>

              <button
                type="button"
                onClick={() =>
                  setError("")
                }
                className="text-red-200/35 hover:text-red-200/70"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {success && (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-400/12 bg-emerald-400/[0.035] px-4 py-3 text-[10px] leading-5 text-emerald-200/65">
              <CheckCircle2
                size={15}
                className="mt-0.5 shrink-0"
              />

              <span className="flex-1">
                {success}
              </span>

              <button
                type="button"
                onClick={() =>
                  setSuccess("")
                }
                className="text-emerald-200/30 hover:text-emerald-200/70"
              >
                <X size={14} />
              </button>
            </div>
          )}

          <div className="mt-8">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-[12px] font-medium text-white/75">
                  Indexed documents
                </h3>

                <p className="mt-1 text-[9px] text-white/25">
                  These sources are available to Memora&apos;s retrieval engine.
                </p>
              </div>

              <div className="relative w-full sm:w-[250px]">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20"
                />

                <input
                  value={query}
                  onChange={(event) =>
                    setQuery(
                      event.target.value
                    )
                  }
                  placeholder="Search documents..."
                  className="h-9 w-full rounded-lg border border-white/[0.07] bg-white/[0.025] pl-9 pr-3 text-[10px] text-white/70 outline-none placeholder:text-white/20 focus:border-violet-300/20"
                />
              </div>
            </div>

            {loading ? (
              <div className="grid min-h-[220px] place-items-center rounded-2xl border border-white/[0.06] bg-white/[0.012]">
                <div className="flex items-center gap-2 text-[10px] text-white/28">
                  <LoaderCircle
                    size={16}
                    className="animate-spin"
                  />
                  Loading knowledge library...
                </div>
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="grid min-h-[220px] place-items-center rounded-2xl border border-white/[0.06] bg-white/[0.012] px-6 text-center">
                <div>
                  <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl border border-white/[0.07] bg-white/[0.025] text-white/25">
                    <HardDrive size={17} />
                  </div>

                  <p className="mt-3 text-[11px] font-medium text-white/50">
                    {documents.length === 0
                      ? "No documents indexed yet"
                      : "No matching documents"}
                  </p>

                  <p className="mt-1 text-[9px] text-white/24">
                    {documents.length === 0
                      ? "Upload your first source to activate document RAG."
                      : "Try a different search term."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {filteredDocuments.map(
                  (document) => {
                    const ImageOrFile =
                      isImageDocument(
                        document
                      )
                        ? FileImage
                        : FileText;

                    return (
                      <article
                        key={document.id}
                        className="group rounded-2xl border border-white/[0.07] bg-gradient-to-br from-white/[0.028] to-white/[0.012] p-4 transition hover:border-violet-300/15 hover:bg-white/[0.032]"
                      >
                        <div className="flex items-start gap-3">
                          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-sky-300/10 bg-sky-400/[0.045] text-sky-300/60">
                            <ImageOrFile
                              size={18}
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <h4
                              title={
                                document.filename
                              }
                              className="truncate text-[11px] font-medium text-white/72"
                            >
                              {
                                document.filename
                              }
                            </h4>

                            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[8px] text-white/25">
                              <span>
                                {document.content_type ===
                                "application/pdf"
                                  ? "PDF"
                                  : document.content_type?.replace(
                                      "image/",
                                      ""
                                    ).toUpperCase() ||
                                    "DOCUMENT"}
                              </span>

                              <span className="h-1 w-1 rounded-full bg-white/15" />

                              <span>
                                {formatDate(
                                  document.created_at
                                )}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={
                              deletingId ===
                              document.id
                            }
                            onClick={() =>
                              void deleteDocument(
                                document
                              )
                            }
                            aria-label={`Delete ${document.filename}`}
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white/20 opacity-60 transition hover:bg-red-400/[0.06] hover:text-red-300/65 group-hover:opacity-100 disabled:cursor-not-allowed"
                          >
                            {deletingId ===
                            document.id ? (
                              <LoaderCircle
                                size={14}
                                className="animate-spin"
                              />
                            ) : (
                              <Trash2
                                size={14}
                              />
                            )}
                          </button>
                        </div>

                        <div className="mt-4 flex items-center justify-between border-t border-white/[0.045] pt-3">
                          <div className="flex items-center gap-2 text-[8px] text-white/28">
                            <ScanText
                              size={12}
                              className="text-violet-300/45"
                            />
                            Searchable by Memora
                          </div>

                          <div className="flex items-center gap-1.5 text-[8px] text-emerald-300/55">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300/65 shadow-[0_0_8px_rgba(110,231,183,0.3)]" />
                            {document.status}
                          </div>
                        </div>
                      </article>
                    );
                  }
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
