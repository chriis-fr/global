import { motion, type Variants } from "framer-motion";

const variants = {
  initial: {
    scaleY: 0.5,
    opacity: 0,
  },
  animate: {
    scaleY: 1,
    opacity: 1,
    transition: {
      repeat: Infinity,
      repeatType: "mirror",
      duration: 1,
      ease: "circIn",
    },
  },
} as unknown as Variants;

const BarLoader = () => {
  return (
    <motion.div
      transition={{
        staggerChildren: 0.25,
      }}
      initial="initial"
      animate="animate"
      className="flex gap-1"
    >
      <motion.div variants={variants} className="h-12 w-2 bg-white" />
      <motion.div variants={variants} className="h-12 w-2 bg-white" />
      <motion.div variants={variants} className="h-12 w-2 bg-white" />
      <motion.div variants={variants} className="h-12 w-2 bg-white" />
      <motion.div variants={variants} className="h-12 w-2 bg-white" />
    </motion.div>
  );
};

interface LoadingSpinnerProps {
  fullScreen?: boolean;
  message?: string;
  className?: string;
}

const LoadingSpinner = ({ 
  fullScreen = false, 
  message = "Loading...", 
  className = "" 
}: LoadingSpinnerProps) => {
  const containerClasses = fullScreen 
    ? "fixed inset-0 bg-gray-900 flex flex-col items-center justify-center z-50"
    : "flex flex-col items-center justify-center p-8";

  return (
    <div className={`${containerClasses} ${className}`}>
      <BarLoader />
      {message && (
        <p className="mt-4 text-white text-sm font-medium">
          {message}
        </p>
      )}
    </div>
  );
};

export default LoadingSpinner;
