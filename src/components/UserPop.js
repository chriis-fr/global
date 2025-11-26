import Face1 from "../../public/globeImages/enterprise.png";
import Face2 from "../../public/globeImages/freelance.png";
import Face3 from "../../public/globeImages/meeting.png";

import {  useRef } from "react";
import GlobeIcon from "../../public/icons/globeIcon";
import Image from "next/image";
import dynamic from "next/dynamic";

const Xarrow = dynamic(() => import("react-xarrows"), {
    ssr: false,
  });

  
  export default function UserPop() {
    const startRef = useRef(null);
  const endRef = useRef(null);
  const middleRef = useRef(null);



  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="flex lg:hidden space-x-4 w-full h-full relative justify-center">
        <Image
          src={Face3.src}
          className="  z-30 absolute left-10 top-2/4 rounded-lg"
          width={40}
          height={40}
          unoptimized={true}
          alt="User"
          ref={startRef}
          id="1"
        ></Image>
        <Xarrow
          start={"2"} //can be react ref
          end={"1"} //or an id
          color="#4cf7029e"
          path="smooth"
          showHead={false}
          showTail={false}
          curveness={2}
          dashness={true}
        />
        <Xarrow
          start={"3"} //can be react ref
          end={"2"} //or an id
          color="#4cf7029e"
          path="smooth"
          dashness={true}
          curveness={0.5}
          showHead={false}
          showTail={false}
        />
        <Image
          src={Face1.src}
          id="2"
          className="absolute right-14 top-1/4 rounded-lg"
          width={40}
          height={40}
          ref={middleRef}
          unoptimized={true}
          alt="User"
        ></Image>
          {GlobeIcon("fill-[#242425]", "125%", "125%")}
        <Image
          ref={endRef}
          id="3"
          src={Face2.src}
          className=" absolute right-1/3 bottom-20 rounded-lg"
          width={35}
          height={35}
          unoptimized={true}
          alt="User"
        ></Image>
      </div>
    </div>
  );
  }