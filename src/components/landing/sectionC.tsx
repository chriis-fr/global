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
    description: 'Manage business payments and streamline outgoing transactions in both crypto and fiat.',
    link: '/services'
  },
  {
    icon: ArrowDownRight,
    title: 'Accounts Receivable',
    description: 'Create invoices and get paid seamlessly in crypto and fiat while staying compliant.',
    link: '/services'
  },
  {
    icon: Receipt,
    title: 'Expenses',
    description: 'Manage corporate expenses, track spending, and get reimbursed easily across crypto and fiat.',
    link: '/services'
  },
  {
    icon: Users,
    title: 'Payroll & Compensation',
    description: 'Pay your team salaries, bonuses, and contractor bills globally in crypto and fiat.',
    link: '/services'
  }
];




const SectionC = () => {
  return (
    <section id="benefits" className="container border-black mt-4 border-4 py-24 sm:py-28">
      
      <div className="grid lg:grid-cols-2 place-items-center lg:gap-24 border-4 border-red-600">
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

                <CardTitle className="text-black">{title}</CardTitle>
              </CardHeader>

              <CardContent className="text-gray-700">
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
