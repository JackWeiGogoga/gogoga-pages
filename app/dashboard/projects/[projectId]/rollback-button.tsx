"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function RollbackButton({
  projectId,
  deploymentId,
  disabled
}: {
  projectId: string;
  deploymentId: string;
  disabled?: boolean;
}) {
  const [pending, setPending] = useState(false);

  async function rollback() {
    setPending(true);

    const response = await fetch(
      `/api/projects/${projectId}/deployments/${deploymentId}/rollback`,
      {
        method: "POST"
      }
    );

    setPending(false);

    if (response.ok) {
      window.location.reload();
    } else {
      const body = await response.json().catch(() => null);
      window.alert(body?.error ?? "回滚失败");
    }
  }

  return (
    <Button variant="outline" size="sm" disabled={disabled || pending} onClick={rollback}>
      {pending ? "回滚中..." : "回滚"}
    </Button>
  );
}
