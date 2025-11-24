import {motion} from "framer-motion"

const SectionE = () => {
    return(
        <div className="text-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            <h3 className="text-xl font-medium mb-4">
              Why Blockchain for Global Business?
            </h3>
            <p className="max-w-2xl mx-auto text-blue-100 mb-6">
              Traditional international business faces challenges with trust, transparency, 
              and transaction costs. Our blockchain integration eliminates these barriers, 
              allowing you to operate globally with confidence.
            </p>
            <button className="px-6 py-2 bg-blue-600 rounded-md hover:bg-blue-700 transition-colors font-medium">
              Learn More About Blockchain Integration
            </button>
          </motion.div>
        </div>
    )
}

export default SectionE;