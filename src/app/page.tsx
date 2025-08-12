import { BlockchainBenefits } from "@/components/landing/blockchain-benefits";
import { Header } from "@/components/landing/header";
import { Footer } from "@/components/landing/footer";

export default function Home() {
  return (
    <div className="bg-white">
      <Header />
      <div className="pt-16">
        <BlockchainBenefits />
      </div>
      <Footer />
    </div>
  );
}
