import Face1 from "../../public/globeImages/enterprise.png";
import Face2 from "../../public/globeImages/freelance.png";
import Face3 from "../../public/globeImages/meeting.png";

// import {  useRef } from "react";
import GlobeIcon from "../../public/icons/globeIcon";
import Image from "next/image";
import dynamic from "next/dynamic";

const Xarrow = dynamic(() => import("react-xarrows"), {
    ssr: false,
});


export default function UserPop() {

    return (
        <div className="w-full h-full">
            <div className="hidden lg:flex space-x-4 w-full h-full relative items-center ">
                <Image
                    src={Face3.src}
                    className="  z-30 absolute left-1/3 top-2/4 rounded-lg"
                    width={65}
                    height={65}
                    unoptimized={true}
                    alt="User"
                    id="4LT"
                ></Image>
                <Xarrow
                    start={"4LT"} //can be react ref
                    end={"5LT"} //or an id
                    color="#4cf7029e"
                    path="smooth"
                    showHead={false}
                    showTail={false}
                    curveness={1.3}
                    dashness={true}
                />
                <Xarrow
                    start={"5LT"} //can be react ref
                    end={"6LT"} //or an id
                    color="#4cf7029e"
                    path="smooth"
                    dashness={true}
                    curveness={0.5}
                    showHead={false}
                    showTail={false}
                />
                <Image
                    src={Face1.src}
                    id="5LT"
                    className="absolute right-1/4  top-1/4 rounded-lg"
                    width={65}
                    height={65}
                    unoptimized={true}
                    alt="User"
                ></Image>
                {GlobeIcon("fill-[#242425]", "100%", "100%")}

                <Image
                    id="6LT"
                    src={Face2.src}
                    className=" absolute right-1/3 rounded-lg"
                    width={65}
                    height={65}
                    unoptimized={true}
                    alt="User"
                ></Image>
            </div>
        </div>
    );
}