"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateProjectForm() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);

    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/projects", {
      method: "POST",
      body: JSON.stringify({
        name: form.get("name"),
        slug: form.get("slug")
      }),
      headers: { "content-type": "application/json" }
    });

    setPending(false);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "创建失败");
      return;
    }

    window.location.reload();
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        创建项目
      </Button>
    );
  }

  return (
    <Card className="w-full sm:w-96">
      <CardHeader>
        <CardTitle>创建项目</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={onSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="name">名称</Label>
            <Input id="name" name="name" placeholder="My Blog" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="slug">Slug</Label>
            <Input id="slug" name="slug" placeholder="my-blog" required />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "创建中..." : "创建"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
