import { Badge } from "../ui/badge";
import Image from "next/image";
import { Button } from "../ui/button";
import { ArrowRight } from "lucide-react";
import Link from "next/link";


const SectionA = () => {

    return (
      <section className="container w-full border-4 border-red-700">
        <div className="grid place-items-center lg:max-w-screen-xl gap-2 mx-auto  md:">
          {/* Logo at top */}
          <div className="flex justify-center mb-">
            {/* <div className="bg-white border-4 border-black rounded-2xl p-2 relative z-10 w-fit">
              <Image
                src="/chainsnobg.png"
                alt="ChainsERP"
                width={100}
                height={100}
                className="rounded-xl top-30 fixed left-25 w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28"
              />
            </div> */}
          </div>

          {/* Main content section */}
          <div className="text-center space-y-8">
            {/* Badge - keep as is */}
            <Badge variant="outline" className="text-sm py-2 bg-white">
              <span className="mr-2 text-primary">
                <Badge>New</Badge>
              </span>
              <span className="inline-flex items-center gap-1.5">
                Invoice Clients via WhatsApp!
                <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
                </svg>
              </span>
            </Badge>

            {/* Heading */}
            <div className="max-w-screen-md mx-auto  text-black text-center text-3xl md:text-5xl font-bold">
              <h1>
                Upgrade Your Business with
                <span className="text-transparent px-2 bg-gradient-to-r from-[#D247BF] to-primary bg-clip-text">
                  The-all-in-one
                </span>
                finance platform
              </h1>
            </div>

            {/* Description */}
            <p className="max-w-screen-sm mx-auto text-xl text-gray-700 text-muted-foreground">
              {`Enterprise-grade security with modern technology ensuring business continuity. Send your customers and clients
              the most flexible invoices; Fast, Flexible, and Secure.`}
            </p>

            {/* Buttons */}
            <div className="flex flex-col md:flex-row items-center justify-center gap-4">
              <Button className="w-5/6 md:w-auto md:px-6 font-bold group/arrow">
                Get Started
                <ArrowRight className="size-5 ml-2 group-hover/arrow:translate-x-1 transition-transform" />
              </Button>

              <Button
                asChild
                variant="secondary"
                className="w-5/6 md:w-auto md:px-6 font-bold"
              >
                <Link
                  href="https://github.com/nobruf/shadcn-landing-page.git"
                  target="_blank"
                >
                  Github respository
                </Link>
              </Button>
            </div>
          </div>

          {/* Hero Image section - styled for future laptop/phone images */}
          <div className="relative group mt-14 border-4 border-black">
            <div className="absolute top-2 lg:-top-8 border-4 border-black left-1/2 transform -translate-x-1/2 w-[90%] mx-auto h-24 lg:h-80 bg-primary/50 rounded-full blur-3xl"></div>
            <Image
              width={1200}
              height={1200}
              className="w-full md:w-[1200px] mx-auto rounded-lg relative leading-none flex items-center border border-t-2 border-secondary border-t-primary/30"
              src="/chainsnobg.png"
              alt="ChainsERP Dashboard"
            />
            <div className="absolute bottom-0 left-0 w-full h-20 md:h-28 bg-gradient-to-b from-background/0 via-background/50 to-background rounded-lg"></div>
          </div>
        </div>
        {/* <div className="text-center mb-16 border-4 border-black relative z-10">
          <div className="flex justify-center">
            <div className="bg-white border-4 border-black mb-4 rounded-2xl p-2 relative z-10">
              <Image
                src="/chainsnobg.png"
                alt="ChainsERP"
                width={150}
                height={150}
                className="rounded-xl"
              />
            </div>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
            Blockchain-Powered {' '}
            <span className="bg-gradient-to-r from-blue-400 to-blue-200 bg-clip-text text-transparent">
              Global Business
            </span>
          </h1>
          <p className="text-xl text-blue-100 max-w-3xl mx-auto">
            Enterprise-grade security and transparency with blockchain technology, 
            designed for modern global business operations
          </p>
        </div> */}
        </section>
    )
}

export default SectionA;