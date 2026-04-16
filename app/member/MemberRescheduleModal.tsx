"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import SlotDateTimePickerModal from "@/app/components/SlotDateTimePickerModal";
import {
  getReschedulePreview,
  rescheduleMyBooking,
  type SlotRemaining,
} from "@/app/actions/bookingActions";

type Props = {
  bookingId: string | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export default function MemberRescheduleModal({ bookingId, open, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noOption, setNoOption] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);
  const [scheduledSlots, setScheduledSlots] = useState<{ date: string; time: string }[]>([]);
  const [slotRemainingList, setSlotRemainingList] = useState<SlotRemaining[]>([]);
  const [capacityEnforced, setCapacityEnforced] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !bookingId) {
      setLoading(false);
      setError(null);
      setNoOption(false);
      setPickOpen(false);
      setScheduledSlots([]);
      setSlotRemainingList([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setNoOption(false);
    setPickOpen(false);

    getReschedulePreview(bookingId).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (!res.success) {
        setError(res.error);
        return;
      }
      if (!res.hasOtherSlotOption) {
        setNoOption(true);
        return;
      }
      setScheduledSlots(res.scheduledSlots);
      setSlotRemainingList(res.slotRemainingList);
      setCapacityEnforced(res.capacityEnforced);
      setPickOpen(true);
    });

    return () => {
      cancelled = true;
    };
  }, [open, bookingId]);

  const handleConfirmSlot = async (date: string, time: string) => {
    if (!bookingId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await rescheduleMyBooking({
        bookingId,
        newSlotDate: date,
        newSlotTime: time,
      });
      if (!res.success) {
        setError(res.error);
        return;
      }
      setPickOpen(false);
      onSuccess();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleClosePicker = () => {
    setPickOpen(false);
    onClose();
  };

  if (!open || !bookingId) return null;

  return (
    <>
      {loading && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
          <div className="relative flex flex-col items-center gap-3 rounded-2xl bg-white px-8 py-10 shadow-xl">
            <Loader2 className="h-8 w-8 animate-spin text-amber-600" aria-hidden />
            <p className="text-sm text-gray-600">載入場次…</p>
          </div>
        </div>
      )}

      {!loading && error && !pickOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" role="alert">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm text-red-700">{error}</p>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
                aria-label="關閉"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 w-full rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              關閉
            </button>
          </div>
        </div>
      )}

      {!loading && noOption && !error && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-bold text-gray-900">改期</h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
                aria-label="關閉"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-4 text-center text-3xl font-medium text-gray-400">無</p>
            <p className="mt-2 text-center text-sm text-gray-600">目前無其他可改期場次</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 w-full rounded-lg bg-brand py-2.5 text-sm font-medium text-white hover:opacity-95"
            >
              關閉
            </button>
          </div>
        </div>
      )}

      {saving && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30">
          <Loader2 className="h-10 w-10 animate-spin text-white" aria-hidden />
        </div>
      )}

      {pickOpen && error && (
        <div
          className="fixed left-1/2 top-4 z-[62] max-w-sm -translate-x-1/2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-center text-sm text-red-800 shadow-lg"
          role="alert"
        >
          {error}
        </div>
      )}

      <SlotDateTimePickerModal
        open={pickOpen && !loading}
        onClose={handleClosePicker}
        onConfirm={handleConfirmSlot}
        availableSlots={scheduledSlots}
        slotRemainingList={slotRemainingList}
        capacityEnforced={capacityEnforced}
        closeOnConfirm={false}
        title="選擇日期與時間"
      />
    </>
  );
}
