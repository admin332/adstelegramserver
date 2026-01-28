import { Skeleton } from "@/components/ui/skeleton";

export const ChannelCardSkeleton = () => {
  return (
    <div className="relative w-full h-48 rounded-3xl overflow-hidden bg-gradient-to-b from-[hsl(217,91%,50%)] to-[hsl(224,76%,48%)]">
      {/* Right side - image placeholder */}
      <div 
        className="absolute inset-0 bg-secondary/30"
        style={{ clipPath: 'polygon(50% 0, 100% 0, 100% 100%, 50% 100%)' }}
      />
      
      {/* Top left - badges */}
      <div className="absolute top-3 left-3 flex items-center gap-2">
        <Skeleton className="h-6 w-14 rounded-full bg-white/20" />
        <Skeleton className="h-6 w-20 rounded-full bg-white/20" />
      </div>
      
      {/* Top right - price */}
      <div className="absolute top-3 right-3 text-right">
        <Skeleton className="h-7 w-16 rounded-md bg-white/20" />
        <Skeleton className="h-3 w-14 mt-1 ml-auto rounded-md bg-white/20" />
      </div>
      
      {/* Center left - subscribers */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2">
        <Skeleton className="h-8 w-24 rounded-md bg-white/20" />
      </div>
      
      {/* Bottom content */}
      <div className="absolute inset-x-0 bottom-0 p-4">
        <div className="flex items-end justify-between">
          <div className="flex-1">
            <Skeleton className="h-5 w-32 rounded-md bg-white/20" />
            <Skeleton className="h-4 w-24 mt-1 rounded-md bg-white/20" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="w-9 h-9 rounded-full bg-white/20" />
            <Skeleton className="w-16 h-9 rounded-full bg-white/20" />
          </div>
        </div>
      </div>
    </div>
  );
};
