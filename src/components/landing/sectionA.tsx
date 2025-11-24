import Image from "next/image";


const SectionA = () => {

    return (
        <div className="text-center mb-16 border-4 border-black relative z-10">
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
        </div>
    )
}

export default SectionA;