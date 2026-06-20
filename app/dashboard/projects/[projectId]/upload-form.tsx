"use client";

import { useState } from "react";
import { FileCode2, RotateCcw, Trash2, Upload } from "lucide-react";
import { appendFiles, FileDropzone } from "@/components/file-dropzone";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";

type CurrentHtmlFile = {
  path: string;
  href: string;
  title: string;
  originalName: string;
  bytes: number;
  removable: boolean;
  sourceKind: "html" | "zip";
};

export function UploadDeploymentForm({
  currentHtmlFiles,
  projectId
}: {
  currentHtmlFiles: CurrentHtmlFile[];
  projectId: string;
}) {
  const [error, setError] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<"replace" | "merge">("replace");
  const [removePaths, setRemovePaths] = useState<string[]>([]);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (files.length === 0 && removePaths.length === 0) {
      setError(mode === "merge" ? "请上传 html 文件，或选择要移除的 html" : "请上传 zip 或 html 文件");
      return;
    }

    setPending(true);

    const form = new FormData();
    appendFiles(form, files);
    form.set("mode", mode);
    for (const removePath of removePaths) {
      form.append("removePath", removePath);
    }

    const response = await fetch(`/api/projects/${projectId}/deployments`, {
      method: "POST",
      body: form
    });

    setPending(false);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "部署失败");
      return;
    }

    setFiles([]);
    setRemovePaths([]);
    window.location.reload();
  }

  function toggleRemovePath(path: string) {
    const file = currentHtmlFiles.find((item) => item.path === path);

    if (!file?.removable) {
      return;
    }

    setRemovePaths((current) =>
      current.includes(path) ? current.filter((item) => item !== path) : [...current, path]
    );
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>上传部署</CardTitle>
        <CardDescription>
          完整替换会生成全新版本；增量新增会基于当前版本追加或覆盖 html 文件。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 pt-6" onSubmit={onSubmit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex cursor-pointer gap-3 rounded-lg border bg-background p-3 text-sm">
              <input
                checked={mode === "replace"}
                className="mt-1"
                name="mode"
                onChange={() => {
                  setMode("replace");
                  setRemovePaths([]);
                }}
                type="radio"
                value="replace"
              />
              <span>
                <span className="block font-medium">完整替换</span>
                <span className="text-muted-foreground">适合上传 zip 或重新发布全部 html。</span>
              </span>
            </label>
            <label className="flex cursor-pointer gap-3 rounded-lg border bg-background p-3 text-sm">
              <input
                checked={mode === "merge"}
                className="mt-1"
                name="mode"
                onChange={() => setMode("merge")}
                type="radio"
                value="merge"
              />
              <span>
                <span className="block font-medium">新增/覆盖 html</span>
                <span className="text-muted-foreground">保留当前版本，只追加或覆盖本次 html。</span>
              </span>
            </label>
          </div>

          <div className="grid gap-2">
            <Label>部署文件</Label>
            <FileDropzone files={files} onFilesChange={setFiles} required={mode === "replace"} />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>

          {mode === "merge" ? (
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <Label>当前部署文件</Label>
                {removePaths.length > 0 ? (
                  <span className="text-xs text-muted-foreground">
                    将移除 {removePaths.length} 个文件
                  </span>
                ) : null}
              </div>
              {currentHtmlFiles.length === 0 ? (
                <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
                  当前版本没有可展示的部署文件。
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto rounded-lg border">
                  {currentHtmlFiles.map((file) => {
                    const markedForRemoval = removePaths.includes(file.path);

                    return (
                      <div
                        className="flex items-center justify-between gap-3 border-b px-3 py-2 text-sm last:border-0 hover:bg-muted/40"
                        key={file.path}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <FileCode2
                            className={
                              markedForRemoval
                                ? "h-4 w-4 shrink-0 text-destructive"
                                : "h-4 w-4 shrink-0 text-muted-foreground"
                            }
                          />
                          <span className="min-w-0">
                            <span
                              className={
                                markedForRemoval
                                  ? "block truncate font-medium text-muted-foreground line-through"
                                  : "block truncate font-medium"
                              }
                            >
                              {file.originalName}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {file.sourceKind === "zip"
                                ? "zip 部署文件，不支持移除"
                                : `${file.href} · ${file.path}`}{" "}
                              · {formatBytes(file.bytes)}
                            </span>
                          </span>
                        </span>
                        {file.removable ? (
                          <Button
                            onClick={() => toggleRemovePath(file.path)}
                            size="sm"
                            type="button"
                            variant={markedForRemoval ? "outline" : "ghost"}
                          >
                            {markedForRemoval ? (
                              <>
                                <RotateCcw className="mr-2 h-3.5 w-3.5" />
                                撤销
                              </>
                            ) : (
                              <>
                                <Trash2 className="mr-2 h-3.5 w-3.5" />
                                移除
                              </>
                            )}
                          </Button>
                        ) : (
                          <span className="shrink-0 rounded-md border px-2 py-1 text-xs text-muted-foreground">
                            只读
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                删除会创建一个新版本，不会直接修改当前版本；如果移除首页且没有上传新的 index.html，发布会失败。
              </p>
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              <Upload className="mr-2 h-4 w-4" />
              {pending
                ? "部署中..."
                : mode === "merge"
                  ? files.length > 0 && removePaths.length > 0
                    ? "新增/移除并发布"
                    : removePaths.length > 0
                      ? "移除并发布"
                    : "新增并发布"
                  : "上传并发布"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}
