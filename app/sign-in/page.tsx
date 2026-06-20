import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-sm">
        <AuthForm
          githubEnabled={Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET)}
          googleEnabled={Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)}
          mode="sign-in"
        />
        <p className="mt-4 text-center text-sm text-muted-foreground">
          还没有账号？{" "}
          <Link className="font-medium text-primary hover:underline" href="/sign-up">
            注册
          </Link>
        </p>
      </div>
    </main>
  );
}
