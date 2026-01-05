import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import {
  Receipt,
  Users,
  ArrowDownRight,
  ArrowUpLeft,
} from 'lucide-react'


const benefits = [
  {
    icon: ArrowUpLeft,
    title: 'Accounts Payable',
    description:
      'Manage outgoing crypto & fiat payments with batch requests for DAOs, automated workflows, audit-ready tracking, and secure supplier wallet validation.',
    link: '/services'
  },
  {
    icon: ArrowDownRight,
    title: 'Accounts Receivable',
    description:
      'Create compliant invoices, accept multi-chain payments, automate cross-currency handling, and keep a clear, auditable record for your finance team.',
    link: '/services'
  },
  {
    icon: Receipt,
    title: 'Expenses',
    description:
      'Track spending, reimburse in crypto or fiat, enforce policies, and keep transparent records with simplified reconciliation and approval flows.',
    link: '/services'
  },
  {
    icon: Users,
    title: 'Payroll & Compensation',
    description:
      'Pay global teams in crypto or fiat with scheduling, bulk payouts, secure address checks, and full visibility over payroll history.',
    link: '/services'
  }
];




const SectionC = () => {
  return (
    <section id="benefits" className="container  mt-4 py-24 sm:py-28">

      <div className="grid lg:grid-cols-2 place-items-center lg:gap-24">
        <div>
          <h2 className="text-lg text-primary font-bold font-sans mb-2 tracking-wider"></h2>

          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-black">
            <span className="text-transparent bg-gradient-to-r from-[#D247BF] to-primary bg-clip-text">
              Cross-border Payments?
            </span>
          </h2>
          <p className="text-xl text-gray-700 mb-8 font-serif relative text-center md:text-left">
            <span className="text-primary font-bold">
              Non-issue.&nbsp;
            </span>
            Get paid the way you want, faster, cheaper and securely. Trust,
            tranparency and low transaction costs. No barriers to you and your business
            whether you are a contractor or a company. Allowing you to operate and expand
            globally with confidence.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-4 w-full">
          {benefits.map(({ icon: IconComponent, title, description }, index) => {
            const Icon = IconComponent;
            return (
              <Card
                key={title}
                className="bg-white hover:bg-gray-50 transition-all delay-75 group/number border border-gray-200 shadow-lg hover:shadow-xl"
              >
                <CardHeader>
                  <div className="flex justify-between">
                    <div className="mb-6 p-3 rounded-lg bg-blue-100 inline-block">
                      <Icon className="w-11 h-11 text-[#0066ff]" />
                    </div>
                    <span className="text-5xl text-gray-200 font-medium transition-all delay-75 group-hover/number:text-gray-300">
                      0{index + 1}
                    </span>
                  </div>

                  <CardTitle className="text-black font-bold font-sans">{title}</CardTitle>
                </CardHeader>

                <CardContent className="text-gray-700 font-serif">
                  {description}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default SectionC;
