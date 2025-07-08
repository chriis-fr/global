import { BlockchainBenefits } from "@/components/landing/blockchain-benefits";
import { Header } from "@/components/landing/header";

export default function Home() {
  return (
    <div className="bg-white">
      <Header />
      <div className="pt-16">
        <BlockchainBenefits />
      </div>
    </div>
  );
}
