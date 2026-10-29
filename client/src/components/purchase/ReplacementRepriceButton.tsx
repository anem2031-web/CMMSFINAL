import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
const labels = {
  ar: {
    title: "إعادة تسعير البديل",
    reason: "سبب إعادة التسعير (10 أحرف على الأقل)",
    cancel: "إلغاء",
    done: "أُعيد البديل للمندوب لإعادة تسعيره",
  },
  en: {
    title: "Return replacement for repricing",
    reason: "Reason for repricing (at least 10 characters)",
    cancel: "Cancel",
    done: "Replacement returned to the delegate for repricing",
  },
  ur: {
    title: "متبادل کی دوبارہ قیمت گذاری",
    reason: "وجہ (کم از کم 10 حروف)",
    cancel: "منسوخ",
    done: "متبادل دوبارہ قیمت گذاری کے لیے نمائندے کو واپس کر دیا گیا",
  },
};
export function ReplacementRepriceButton({
  batch,
  onComplete,
}: {
  batch: {
    id: number;
    status: string;
    replacementFunding?: unknown;
    batchItems: Array<{ id: number; itemName: string; status: string }>;
  };
  onComplete: () => void;
}) {
  const { user } = useAuth();
  const { language } = useTranslation();
  const text = labels[language as keyof typeof labels] || labels.en;
  const [open, setOpen] = useState(false),
    [reason, setReason] = useState("");
  const reprice = trpc.purchaseOrders.approveManagementBatch.useMutation({
    onSuccess: () => {
      toast.success(text.done);
      setOpen(false);
      setReason("");
      onComplete();
    },
    onError: error => toast.error(error.message),
  });
  const active = batch.batchItems.filter(
    item => !["rejected", "cancelled"].includes(item.status)
  );
  if (
    !batch.replacementFunding ||
    batch.status !== "pending_management" ||
    active.length !== 1 ||
    !["owner", "admin", "senior_management"].includes(user?.role || "")
  )
    return null;
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        disabled={reprice.isPending}
        onClick={() => setOpen(true)}
      >
        {text.title}
      </Button>
      <Dialog
        open={open}
        onOpenChange={value => {
          if (!reprice.isPending) setOpen(value);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{text.title}</DialogTitle>
          </DialogHeader>
          <p>{active[0].itemName}</p>
          <Textarea
            aria-label={text.reason}
            placeholder={text.reason}
            value={reason}
            maxLength={4000}
            onChange={event => setReason(event.target.value)}
          />
          <DialogFooter>
            <Button
              variant="outline"
              disabled={reprice.isPending}
              onClick={() => setOpen(false)}
            >
              {text.cancel}
            </Button>
            <Button
              disabled={reason.trim().length < 10 || reprice.isPending}
              onClick={() =>
                reprice.mutate({
                  batchId: batch.id,
                  rejectedItemIds: [active[0].id],
                  rejectionReason: reason.trim(),
                })
              }
            >
              {text.title}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
