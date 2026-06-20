"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const isSignUp = mode === "sign-up";

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const name = String(formData.get("name") ?? email);

    const result = isSignUp
      ? await authClient.signUp.email({
          email,
          password,
          name,
          callbackURL: "/dashboard"
        })
      : await authClient.signIn.email({
          email,
          password,
          callbackURL: "/dashboard"
        });

    setPending(false);

    if (result.error) {
      setError(result.error.message ?? "认证失败");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isSignUp ? "创建账号" : "登录"}</CardTitle>
        <CardDescription>
          {isSignUp ? "创建账号后开始管理你的项目。" : "登录后管理你的项目和部署。"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={onSubmit}>
          {isSignUp ? (
            <div className="grid gap-2">
              <Label htmlFor="name">名称</Label>
              <Input id="name" name="name" placeholder="你的名字" required />
            </div>
          ) : null}
          <div className="grid gap-2">
            <Label htmlFor="email">邮箱</Label>
            <Input id="email" name="email" placeholder="you@example.com" required type="email" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">密码</Label>
            <Input id="password" minLength={8} name="password" required type="password" />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button disabled={pending} type="submit">
            {pending ? "处理中..." : isSignUp ? "注册" : "登录"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
