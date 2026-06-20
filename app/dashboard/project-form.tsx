"use client";

import { useId, useState } from "react";
import { Plus } from "lucide-react";
import { appendFiles, FileDropzone } from "@/components/file-dropzone";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateProjectForm() {
  const nameId = useId();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);

    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/projects", {
      method: "POST",
      body: JSON.stringify({
        name: form.get("name")
      }),
      headers: { "content-type": "application/json" }
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "创建失败");
      setPending(false);
      return;
    }

    const project = (await response.json()) as { id: string };

    if (files.length > 0) {
      const uploadForm = new FormData();
      appendFiles(uploadForm, files);

      const uploadResponse = await fetch(`/api/projects/${project.id}/deployments`, {
        method: "POST",
        body: uploadForm
      });

      if (!uploadResponse.ok) {
        const body = await uploadResponse.json().catch(() => null);
        setError(`项目已创建，但部署失败：${body?.error ?? "上传失败"}`);
        setPending(false);
        return;
      }
    }

    setPending(false);
    setOpen(false);
    setFiles([]);
    window.location.reload();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          创建项目
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>创建项目</DialogTitle>
          <DialogDescription>
            项目名称只能使用英文；域名 slug 会根据名称自动生成。可同时上传静态文件。
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={onSubmit}>
          <div className="grid gap-2">
            <Label htmlFor={nameId}>名称</Label>
            <Input
              id={nameId}
              name="name"
              pattern="[A-Za-z0-9][A-Za-z0-9 -]*"
              placeholder="My Blog"
              required
              title="只能包含英文字母、数字、空格和中划线"
            />
          </div>
          <div className="grid gap-2">
            <Label>静态文件（可选）</Label>
            <FileDropzone files={files} onFilesChange={setFiles} />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? (files.length > 0 ? "创建并部署中..." : "创建中...") : "创建"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
