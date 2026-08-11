// frontend/src/features/sections/components/SectionCardSkeleton.tsx
export function SectionCardSkeleton() {
  return (
    <div className="rounded-2xl border border-[#1E3447] bg-[#0D1722]/70 backdrop-blur-xl p-5 animate-pulse">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <div className="h-4 w-2/3 rounded bg-[#162534]" />
          <div className="h-3 w-1/3 rounded bg-[#162534]" />
        </div>
        <div className="h-5 w-5 rounded bg-[#162534]" />
      </div>
      <div className="flex items-center gap-4 mt-4">
        <div className="h-3 w-16 rounded bg-[#162534]" />
        <div className="h-3 w-16 rounded bg-[#162534]" />
        <div className="h-3 w-16 rounded bg-[#162534]" />
      </div>
      <div className="flex items-center mt-4 -space-x-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-7 w-7 rounded-full bg-[#162534] ring-2 ring-[#0D1722]" />
        ))}
      </div>
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#1E3447]">
        <div className="h-4 w-14 rounded-full bg-[#162534]" />
        <div className="h-6 w-16 rounded-lg bg-[#162534]" />
      </div>
    </div>
  );
}
