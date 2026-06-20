"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
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
                  <GitHubIcon className="mr-2 h-4 w-4" />
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

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      role="img"
      viewBox="0 0 24 24"
    >
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.92.58.11.79-.25.79-.56v-2.14c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.23-1.28-5.23-5.68 0-1.25.45-2.28 1.19-3.08-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.16 1.18A11 11 0 0 1 12 6.08c.98 0 1.95.13 2.87.39 2.19-1.49 3.15-1.18 3.15-1.18.63 1.58.24 2.75.12 3.04.74.8 1.18 1.83 1.18 3.08 0 4.42-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.14v3.14c0 .31.21.67.79.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}
