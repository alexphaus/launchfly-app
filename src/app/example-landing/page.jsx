// Example: How to add AI Sales Agent to any landing page
import SalesAgent from '../../../components/SalesAgent';

export default function ExampleLandingPage() {
  // Product configuration for the AI agent
  const productConfig = {
    name: "Launchfly Business Accelerator",
    audience: "entrepreneurs and small business owners",
    benefit: "grow their business faster and find more customers",
    problem: "finding customers and scaling revenue",
    price: "$97",
    originalPrice: "$297",
    offer: "LAUNCH20", // 20% discount code
    id: "launchfly_accelerator",
    timeframe: "30 days"
  };

  // Optional agent configuration
  const agentConfig = {
    triggerDelay: 15, // Show chat after 15 seconds
    aggressiveness: 7, // 1-10 scale
    maxDiscount: 30
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Your existing landing page content */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Your Business Solution</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            Grow Your Business
            <span className="block text-blue-600">10x Faster</span>
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Stop struggling to find customers. Our AI-powered system finds, 
            contacts, and converts prospects automatically while you focus on 
            what you do best.
          </p>
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 
                           rounded-lg text-lg font-semibold transition-colors">
            Get Started Today
          </button>
        </div>

        {/* Features Section */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="text-3xl mb-4">🎯</div>
            <h3 className="text-xl font-semibold mb-2">Find Perfect Prospects</h3>
            <p className="text-gray-600">
              AI identifies and researches your ideal customers automatically.
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="text-3xl mb-4">📧</div>
            <h3 className="text-xl font-semibold mb-2">Personalized Outreach</h3>
            <p className="text-gray-600">
              Send perfectly crafted emails that get responses and book meetings.
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="text-3xl mb-4">📈</div>
            <h3 className="text-xl font-semibold mb-2">Scale Automatically</h3>
            <p className="text-gray-600">
              System optimizes and scales your growth without manual work.
            </p>
          </div>
        </div>

        {/* Pricing Section */}
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center mb-16">
          <h3 className="text-3xl font-bold mb-4">Simple Pricing</h3>
          <div className="text-gray-500 line-through text-xl mb-2">$297</div>
          <div className="text-5xl font-bold text-blue-600 mb-4">$97</div>
          <p className="text-gray-600 mb-6">One-time payment • Lifetime access</p>
          <button className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 
                           rounded-lg text-lg font-semibold transition-colors">
            Start Growing Today
          </button>
          <p className="text-sm text-gray-500 mt-4">30-day money-back guarantee</p>
        </div>

        {/* Testimonials */}
        <div className="mb-16">
          <h3 className="text-3xl font-bold text-center mb-8">What Customers Say</h3>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <p className="text-gray-600 mb-4">
                "Went from 2 clients to 20 clients in just 6 weeks. This system works!"
              </p>
              <div className="font-semibold">Sarah Chen</div>
              <div className="text-gray-500">Marketing Consultant</div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <p className="text-gray-600 mb-4">
                "Finally, a solution that actually finds customers on autopilot."
              </p>
              <div className="font-semibold">Mike Rodriguez</div>
              <div className="text-gray-500">SaaS Founder</div>
            </div>
          </div>
        </div>
      </main>

      {/* 
        ADD THE AI SALES AGENT - This is all you need!
        It will automatically appear after 15 seconds and engage visitors
      */}
      <SalesAgent 
        product={productConfig}
        config={agentConfig}
      />
    </div>
  );
}
