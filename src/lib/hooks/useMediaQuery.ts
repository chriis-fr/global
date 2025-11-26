import { useState, useEffect } from "react";

interface WindowDimensions {
  width: number | undefined;
  height: number | undefined;
}

function getWindowDimensions(): WindowDimensions {
  if (typeof window === "undefined") {
    return { width: undefined, height: undefined };
  }

  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

export default function useMediaQuery(): WindowDimensions {
  const [windowDimensions, setWindowDimensions] = useState<WindowDimensions>(
    getWindowDimensions()
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleResize = () => {
      setWindowDimensions(getWindowDimensions());
    };

    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return windowDimensions;
}
