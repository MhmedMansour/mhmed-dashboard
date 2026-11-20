import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div
      dir="rtl"
      className="min-h-screen dashboard-shell flex items-center justify-center p-6"
    >
      <div className="clay-card max-w-md w-full text-center p-10">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-b from-[#d8e6f0] to-[#9fb6c8] text-[#1e3142] shadow-md">
          <Compass className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
          الصفحة غير موجودة
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          الرابط الذي فتحته غير صحيح أو تم نقله. ارجع إلى لوحة التحكم لمتابعة عملك.
        </p>
        <Link
          href="/"
          className="clay-btn-teal mt-6 inline-flex items-center gap-2 px-6 py-3 text-sm"
        >
          العودة إلى لوحة التحكم
        </Link>
      </div>
    </div>
  );
}
