import * as React from "react";
import { motion } from "framer-motion";

export interface ImageGenerationProps {
  children: React.ReactNode;
  /** Total reveal duration in ms once generating begins. Default 30000. */
  duration?: number;
  /** Delay before the reveal starts (the "getting started" phase) in ms. Default 3000. */
  startDelay?: number;
}

export const ImageGeneration = ({
  children,
  duration = 30000,
  startDelay = 3000,
}: ImageGenerationProps) => {
  const [progress, setProgress] = React.useState(0);
  const [loadingState, setLoadingState] = React.useState<
    "starting" | "generating" | "completed"
  >("starting");

  React.useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;

    const startingTimeout = setTimeout(() => {
      setLoadingState("generating");

      const startTime = Date.now();

      interval = setInterval(() => {
        const elapsedTime = Date.now() - startTime;
        const progressPercentage = Math.min(100, (elapsedTime / duration) * 100);

        setProgress(progressPercentage);

        if (progressPercentage >= 100) {
          if (interval) clearInterval(interval);
          setLoadingState("completed");
        }
      }, 16);
    }, startDelay);

    return () => {
      clearTimeout(startingTimeout);
      if (interval) clearInterval(interval);
    };
  }, [duration, startDelay]);

  return (
    <div className="flex flex-col gap-2">
      <motion.span
        className="bg-[linear-gradient(110deg,hsl(var(--muted-foreground)),35%,hsl(var(--foreground)),50%,hsl(var(--muted-foreground)),75%,hsl(var(--muted-foreground)))] bg-[length:200%_100%] bg-clip-text text-transparent text-sm font-medium"
        initial={{ backgroundPosition: "200% 0" }}
        animate={{
          backgroundPosition: loadingState === "completed" ? "0% 0" : "-200% 0",
        }}
        transition={{
          repeat: loadingState === "completed" ? 0 : Infinity,
          duration: 3,
          ease: "linear",
        }}
      >
        {loadingState === "starting" && "Getting started."}
        {loadingState === "generating" && "Creating image. May take a moment."}
        {loadingState === "completed" && "Image created."}
      </motion.span>
      <div className="relative rounded-xl border border-white/[0.08] bg-wa-surface w-full overflow-hidden">
        {children}
        <motion.div
          className="absolute w-full h-[125%] -top-[25%] pointer-events-none bg-wa-surface"
          initial={false}
          animate={{
            clipPath: `polygon(0 ${progress}%, 100% ${progress}%, 100% 100%, 0 100%)`,
            opacity: loadingState === "completed" ? 0 : 1,
          }}
          style={{
            clipPath: `polygon(0 ${progress}%, 100% ${progress}%, 100% 100%, 0 100%)`,
            maskImage:
              progress === 0
                ? "linear-gradient(to bottom, black -5%, black 100%)"
                : `linear-gradient(to bottom, transparent ${progress - 5}%, transparent ${progress}%, black ${progress + 5}%)`,
            WebkitMaskImage:
              progress === 0
                ? "linear-gradient(to bottom, black -5%, black 100%)"
                : `linear-gradient(to bottom, transparent ${progress - 5}%, transparent ${progress}%, black ${progress + 5}%)`,
          }}
        />
      </div>
    </div>
  );
};

ImageGeneration.displayName = "ImageGeneration";
