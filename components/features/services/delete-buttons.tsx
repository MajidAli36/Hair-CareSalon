"use client";

import { Trash2 } from "lucide-react";
import { deleteCategory, deletePackage, deleteService } from "@/lib/actions/services";
import { ConfirmAction } from "@/components/ui/confirm-action";

const deleteBtnClass =
  "gap-1.5 border-destructive/25 bg-destructive/5 text-destructive shadow-sm transition-all hover:border-destructive/50 hover:bg-destructive hover:text-destructive-foreground hover:shadow-md";

export function DeleteCategoryButton({ id, name }: { id: string; name?: string }) {
  return (
    <ConfirmAction
      title="Delete category?"
      description={
        name
          ? `Delete “${name}”? Services in this category will need reassignment.`
          : "This category will be permanently deleted."
      }
      confirmLabel="Delete"
      pendingLabel="Deleting…"
      variant="outline"
      className={deleteBtnClass}
      onConfirm={async () => {
        await deleteCategory(id);
      }}
    >
      <Trash2 className="size-3.5" />
      Delete
    </ConfirmAction>
  );
}

export function DeleteServiceButton({ id, name }: { id: string; name?: string }) {
  return (
    <ConfirmAction
      title="Delete service?"
      description={
        name
          ? `Delete “${name}”? This cannot be undone from the catalog.`
          : "This service will be permanently deleted."
      }
      confirmLabel="Delete"
      pendingLabel="Deleting…"
      variant="outline"
      className={deleteBtnClass}
      onConfirm={async () => {
        await deleteService(id);
      }}
    >
      <Trash2 className="size-3.5" />
      Delete
    </ConfirmAction>
  );
}

export function DeletePackageButton({ id, name }: { id: string; name?: string }) {
  return (
    <ConfirmAction
      title="Delete package?"
      description={
        name
          ? `Delete “${name}”? This cannot be undone from the catalog.`
          : "This package will be permanently deleted."
      }
      confirmLabel="Delete"
      pendingLabel="Deleting…"
      variant="outline"
      className={deleteBtnClass}
      onConfirm={async () => {
        await deletePackage(id);
      }}
    >
      <Trash2 className="size-3.5" />
      Delete
    </ConfirmAction>
  );
}
