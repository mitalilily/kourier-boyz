import { Typography } from "antd";
import { useEffect, useState } from "react";

const { Text } = Typography;

const LoadingState = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [dots, setDots] = useState("");

  useEffect(() => {
    // Trigger fade-in animation
    setIsVisible(true);

    // Animate loading dots
    const interval = setInterval(() => {
      setDots((prev) => {
        if (prev === "...") return "";
        return prev + ".";
      });
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center w-full h-full p-4">
      <div
        className={`transition-opacity duration-500 ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="relative w-20 h-20 mb-6">
          <div className="spinner-ring-1 absolute inset-0 w-20 h-20 border-4 border-blue-100 border-t-blue-500 rounded-full"></div>
          <div className="spinner-ring-2 absolute top-2.5 left-2.5 w-[60px] h-[60px] border-4 border-blue-100 border-t-blue-400 rounded-full"></div>
          <div className="spinner-ring-3 absolute top-5 left-5 w-10 h-10 border-4 border-blue-100 border-t-blue-300 rounded-full"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50 animate-pulse" />
        </div>

        <Text className="text-base text-gray-400 font-medium tracking-wide block text-center">
          Loading{dots}
        </Text>
      </div>
    </div>
  );
};

export default LoadingState;
