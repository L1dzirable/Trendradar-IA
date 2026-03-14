import { motion } from "framer-motion";

export function RadarLoading() {
  return (
    <div className="w-full max-w-2xl mx-auto p-12 flex flex-col items-center justify-center space-y-8 glass-panel rounded-3xl">
      <div className="relative w-32 h-32 rounded-full border border-primary/20 bg-primary/5 flex items-center justify-center overflow-hidden shadow-inner">
        {/* Grid lines */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:16px_16px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_70%)]" />
        
        {/* Radar sweeping effect */}
        <div className="absolute inset-0 radar-sweep opacity-60" />
        
        {/* Concentric circles */}
        <div className="absolute w-24 h-24 rounded-full border border-primary/20" />
        <div className="absolute w-16 h-16 rounded-full border border-primary/30" />
        <div className="absolute w-8 h-8 rounded-full border border-primary/40 bg-primary/10" />
        
        {/* Center dot */}
        <div className="absolute w-2 h-2 rounded-full bg-primary shadow-[0_0_10px_rgba(var(--primary),0.8)] animate-pulse" />
      </div>
      
      <div className="space-y-2 text-center">
        <motion.h3 
          animate={{ opacity: [0.5, 1, 0.5] }} 
          transition={{ duration: 2, repeat: Infinity }}
          className="text-lg font-bold text-foreground"
        >
          Scanning for opportunities...
        </motion.h3>
        <p className="text-sm text-muted-foreground">
          Our AI is analyzing market signals and data points.
        </p>
      </div>
    </div>
  );
}
