"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function UploadDeploymentForm({ projectId }: { projectId: string }) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);

    const form = new FormData(event.currentTarget);
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

    window.location.reload();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>上传部署</CardTitle>
        <CardDescription>
          上传一个 zip，或一次选择多个 html 文件并自动发布到子路径。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 sm:grid-cols-[1fr_auto]" onSubmit={onSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="file">部署文件</Label>
            <Input
              id="file"
              name="file"
              type="file"
              accept=".zip,.html,.htm,application/zip,text/html"
              multiple
              required
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          <Button className="self-end" type="submit" disabled={pending}>
            <Upload className="mr-2 h-4 w-4" />
            {pending ? "部署中..." : "上传并发布"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
