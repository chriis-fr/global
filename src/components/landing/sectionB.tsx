import Face1 from "../../../public/globeImages/enterprise.png";
import Face2 from "../../../public/globeImages/freelance.png";
import Face3 from "../../../public/globeImages/meeting.png";

import { motion } from 'framer-motion'
import useMediaQuery from "@/lib/hooks/useMediaQuery"
import dynamic from "next/dynamic"
import { useLayoutEffect, useState } from "react"
import Image from "next/image"
const UserPop = dynamic(() => import("../UserPop"), { ssr: false });

const UserPopLg = dynamic(() => import("../UserPopLg"), { ssr: false });


const SectionB = () => {
  const images = [
    [
      { img: Face3, name: "Face3" },
      
    ],
    [
      { img: Face1, name: "Face1" },
      { img: Face2, name: "Face2" },
    ],
  ];

  const { width,  } = useMediaQuery();

  const [, setSize] = useState([0, 0]);

  useLayoutEffect(() => {
    function updateSize() {
      setSize([window.innerWidth, window.innerHeight]);
    }
    window.addEventListener("resize", updateSize);
    updateSize();
    return () => window.removeEventListener("resize", updateSize);
  }, []);


  const isMobile = width ? width < 1023 : true;

    return(
        <div className="h-screen w-full border-8 border-red-600 bg-[#1a1a1a] text-[#4cf7029e] flex items-center flex-col mt-12 justify-center relative overflow-hidden">
          {/* Mobile Text */}
          <div className="font-Neue text-3xl mb-4 p-8 ml-6 flex lg:hidden flex-col lg:text-6xl lg:w-3/5 w-screen lg:text-left absolute top-10">
            {["Invoice, Receive ", "& Pay ", "all round the", "Globe"].map((wrd, index) => {
              return (
                <div
                  className={`${
                    index === 1 ? "self-start border-2 text-white" : "self-end "
                  } p-2 px-4 rounded-full border-gray-600`}
                  key={index}
                >
                  {wrd}
                </div>
              );
            })}
          </div>

          {/* Mobile UserPop */}
          <div className="lg:hidden flex flex-col lg:items-center justify-between">
            <div className="w-screen flex items-center justify-center absolute bottom-20 left-1/2 -translate-x-1/2">
              {isMobile && <UserPop key={"first"}></UserPop>}
            </div>

            <div className="hidden lg:hidden">
              {images.map((col, index) => {
                return (
                  <div key={index} className={`${index === 1 ? "mt-8" : ""}`}>
                    {col.map((img) => {
                      return (
                        <div key={img.name} className="">
                          <Image
                            src={img.img.src}
                            key={img.name}
                            width={120}
                            height={120}
                            alt="User Image"
                            unoptimized={true}
                            className="w-[150px] h-[150px] lg:w-[250px] lg:h-[250px] border rounded-3xl shadow-md mb-2 border-gray-300"
                          ></Image>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Desktop Layout */}
          <div className="hidden lg:flex space-x-2 items-center justify-center">
            <motion.div className="absolute -left-1/4 w-full -bottom-2/4">
              {!isMobile && <UserPopLg></UserPopLg>}
            </motion.div>

            <div className="font-Neue z-30  text-[#4cf7029e] flex flex-col absolute w-2/5 xl:w-2/5 text-6xl right-10 xl:left-none top-20 text-right">
              Send Invoices{" "}
              <div className="p-2 border rounded-full text-left text-white px-4 ">
                Around{" "}
              </div>
              <span className="text-[#4cf7029e]">the Globe</span>
            </div>


            <div className="hidden absolute right-4 space-x-4">
              {images.map((col, index) => {
                return (
                  <div key={index} className={`${index === 1 ? "mt-20" : ""}`}>
                    {col.map((img) => {
                      return (
                        <div key={img.name} className="">
                          <Image
                            src={img.img.src}
                            key={img.name}
                            width={120}
                            height={120}
                            alt="User Image"
                            unoptimized={true}
                            className="w-[150px] h-[150px] lg:w-[200px] lg:h-[200px] border rounded-3xl shadow-md mb-2 border-gray-300"
                          ></Image>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
    )
}

export default SectionB;