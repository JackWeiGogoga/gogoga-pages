import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export default function SignUpPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-sm">
        <AuthForm mode="sign-up" />
        <p className="mt-4 text-center text-sm text-muted-foreground">
          已有账号？{" "}
          <Link className="font-medium text-primary hover:underline" href="/sign-in">
            登录
          </Link>
        </p>
      </div>
    </main>
  );
}
