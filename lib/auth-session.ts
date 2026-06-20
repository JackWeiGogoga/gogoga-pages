import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export async function getSession() {
  return auth.api.getSession({
    headers: await headers()
  });
}

export async function requireUser() {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in");
  }

  return session.user;
}

export async function getRequestUser(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers
  });

  return session?.user ?? null;
}
