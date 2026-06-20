"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { siGithub, siGoogle } from "simple-icons";
import { authClient } from "@/lib/auth-client";
import { BrandIcon } from "@/components/brand-icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AuthForm({
  githubEnabled = false,
  googleEnabled = false,
  mode
}: {
  githubEnabled?: boolean;
  googleEnabled?: boolean;
  mode: "sign-in" | "sign-up";
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [socialPending, setSocialPending] = useState<"google" | "github" | null>(null);
  const isSignUp = mode === "sign-up";
  const showSocial = googleEnabled || githubEnabled;

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

  async function signInWithProvider(provider: "google" | "github") {
    setError("");
    setSocialPending(provider);

    const result = await authClient.signIn.social({
      provider,
      callbackURL: "/dashboard",
      errorCallbackURL: mode === "sign-up" ? "/sign-up" : "/sign-in"
    });

    if (result.error) {
      setError(result.error.message ?? "第三方登录失败");
      setSocialPending(null);
    }
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
        <div className="grid gap-4">
          {showSocial ? (
            <div className="grid gap-2">
              {googleEnabled ? (
                <Button
                  disabled={pending || Boolean(socialPending)}
                  onClick={() => signInWithProvider("google")}
                  type="button"
                  variant="outline"
                >
                  <BrandIcon className="mr-2 h-4 w-4" icon={siGoogle} />
                  {socialPending === "google" ? "跳转中..." : "使用 Google 继续"}
                </Button>
              ) : null}
              {githubEnabled ? (
                <Button
                  disabled={pending || Boolean(socialPending)}
                  onClick={() => signInWithProvider("github")}
                  type="button"
                  variant="outline"
                >
                  <BrandIcon className="mr-2 h-4 w-4" icon={siGithub} />
                  {socialPending === "github" ? "跳转中..." : "使用 GitHub 继续"}
                </Button>
              ) : null}
            </div>
          ) : null}

          {showSocial ? (
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">或使用邮箱</span>
              </div>
            </div>
          ) : null}

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
        </div>
      </CardContent>
    </Card>
  );
}
