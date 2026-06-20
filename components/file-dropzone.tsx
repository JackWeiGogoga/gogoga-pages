"use client";

import { useId, useMemo, useState } from "react";
import { FileArchive, FileCode2, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const accept = ".zip,.html,.htm,application/zip,text/html";

export function FileDropzone({
  compact = false,
  files,
  onFilesChange,
  required = false
}: {
  compact?: boolean;
  files: File[];
  onFilesChange: (files: File[]) => void;
  required?: boolean;
}) {
  const inputId = useId();
  const [dragging, setDragging] = useState(false);
  const summary = useMemo(() => {
    if (files.length === 0) return "支持一个 zip，或多个 html/htm 文件";
    return `${files.length} 个文件，${formatBytes(files.reduce((total, file) => total + file.size, 0))}`;
  }, [files]);

  function setSelectedFiles(fileList: FileList | File[]) {
    onFilesChange(Array.from(fileList));
  }

  return (
    <div className="grid gap-2">
      <input
        accept={accept}
        className="sr-only"
        id={inputId}
        multiple
        name="file"
        onChange={(event) => setSelectedFiles(event.currentTarget.files ?? [])}
        aria-required={required}
        type="file"
      />
      <label
        className={cn(
          "flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 px-4 py-6 text-center transition-colors hover:bg-muted/40",
          compact && "min-h-20 py-4",
          dragging && "border-primary bg-muted/60"
        )}
        htmlFor={inputId}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          setSelectedFiles(event.dataTransfer.files);
        }}
      >
        <UploadCloud className={cn("mb-3 h-6 w-6 text-muted-foreground", compact && "mb-2 h-5 w-5")} />
        <div className="text-sm font-medium">拖拽文件到这里，或点击选择</div>
        <div className="mt-1 text-xs text-muted-foreground">{summary}</div>
      </label>

      {files.length > 0 ? (
        <div className="grid gap-2">
          {files.map((file) => (
            <div
              className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2 text-sm"
              key={`${file.name}-${file.size}-${file.lastModified}`}
            >
              <div className="flex min-w-0 items-center gap-2">
                {file.name.toLowerCase().endsWith(".zip") ? (
                  <FileArchive className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <FileCode2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0">
                  <div className="truncate">{file.name}</div>
                  <div className="text-xs text-muted-foreground">{formatBytes(file.size)}</div>
                </div>
              </div>
              <Button
                aria-label={`移除 ${file.name}`}
                onClick={() => onFilesChange(files.filter((item) => item !== file))}
                size="icon"
                type="button"
                variant="ghost"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function appendFiles(formData: FormData, files: File[]) {
  for (const file of files) {
    formData.append("file", file);
  }
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}
