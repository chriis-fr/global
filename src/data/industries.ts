export interface Industry {
  id: string;
  name: string;
  category: string;
  description?: string;
}

export const industries: Industry[] = [
  // Technology
  { id: 'tech-software', name: 'Software Development', category: 'Technology', description: 'Custom software, SaaS, mobile apps' },
  { id: 'tech-hardware', name: 'Hardware Manufacturing', category: 'Technology', description: 'Computers, electronics, devices' },
  { id: 'tech-ai', name: 'Artificial Intelligence', category: 'Technology', description: 'AI/ML, data science, automation' },
  { id: 'tech-cybersecurity', name: 'Cybersecurity', category: 'Technology', description: 'Security software, consulting' },
  { id: 'tech-cloud', name: 'Cloud Computing', category: 'Technology', description: 'Cloud services, infrastructure' },
  { id: 'tech-blockchain', name: 'Blockchain/Crypto', category: 'Technology', description: 'Cryptocurrency, DeFi, NFTs' },
  { id: 'tech-gaming', name: 'Gaming', category: 'Technology', description: 'Video games, esports, gaming platforms' },
  { id: 'tech-ecommerce', name: 'E-commerce', category: 'Technology', description: 'Online retail, marketplaces' },
  { id: 'tech-fintech', name: 'Fintech', category: 'Technology', description: 'Financial technology, digital banking' },
  { id: 'tech-edtech', name: 'EdTech', category: 'Technology', description: 'Educational technology, online learning' },
  { id: 'tech-healthtech', name: 'HealthTech', category: 'Technology', description: 'Healthcare technology, telemedicine' },
  { id: 'tech-iot', name: 'Internet of Things', category: 'Technology', description: 'IoT devices, smart home, industrial IoT' },

  // Finance & Banking
  { id: 'finance-banking', name: 'Banking', category: 'Finance', description: 'Traditional banking, credit unions' },
  { id: 'finance-investment', name: 'Investment Management', category: 'Finance', description: 'Asset management, wealth management' },
  { id: 'finance-insurance', name: 'Insurance', category: 'Finance', description: 'Life, health, property insurance' },
  { id: 'finance-accounting', name: 'Accounting', category: 'Finance', description: 'Bookkeeping, tax services, auditing' },
  { id: 'finance-real-estate', name: 'Real Estate', category: 'Finance', description: 'Property management, real estate investment' },
  { id: 'finance-cryptocurrency', name: 'Cryptocurrency', category: 'Finance', description: 'Crypto trading, mining, DeFi' },

  // Healthcare
  { id: 'healthcare-pharmaceuticals', name: 'Pharmaceuticals', category: 'Healthcare', description: 'Drug development, manufacturing' },
  { id: 'healthcare-medical-devices', name: 'Medical Devices', category: 'Healthcare', description: 'Medical equipment, diagnostics' },
  { id: 'healthcare-hospitals', name: 'Hospitals & Clinics', category: 'Healthcare', description: 'Healthcare facilities, medical centers' },
  { id: 'healthcare-telemedicine', name: 'Telemedicine', category: 'Healthcare', description: 'Remote healthcare, virtual consultations' },
  { id: 'healthcare-wellness', name: 'Wellness & Fitness', category: 'Healthcare', description: 'Fitness, wellness, mental health' },

  // Manufacturing
  { id: 'manufacturing-automotive', name: 'Automotive', category: 'Manufacturing', description: 'Car manufacturing, auto parts' },
  { id: 'manufacturing-aerospace', name: 'Aerospace', category: 'Manufacturing', description: 'Aircraft, space technology' },
  { id: 'manufacturing-electronics', name: 'Electronics', category: 'Manufacturing', description: 'Consumer electronics, components' },
  { id: 'manufacturing-textiles', name: 'Textiles & Apparel', category: 'Manufacturing', description: 'Clothing, fabrics, fashion' },
  { id: 'manufacturing-food', name: 'Food & Beverage', category: 'Manufacturing', description: 'Food processing, beverages' },
  { id: 'manufacturing-chemicals', name: 'Chemicals', category: 'Manufacturing', description: 'Chemical manufacturing, materials' },

  // Retail & Consumer
  { id: 'retail-fashion', name: 'Fashion & Apparel', category: 'Retail', description: 'Clothing, accessories, luxury goods' },
  { id: 'retail-ecommerce', name: 'E-commerce Retail', category: 'Retail', description: 'Online retail, marketplaces' },
  { id: 'retail-grocery', name: 'Grocery & Food', category: 'Retail', description: 'Supermarkets, food retail' },
  { id: 'retail-home', name: 'Home & Garden', category: 'Retail', description: 'Furniture, home improvement' },
  { id: 'retail-beauty', name: 'Beauty & Personal Care', category: 'Retail', description: 'Cosmetics, skincare, beauty products' },
  { id: 'retail-sports', name: 'Sports & Outdoor', category: 'Retail', description: 'Sporting goods, outdoor equipment' },

  // Professional Services
  { id: 'services-consulting', name: 'Consulting', category: 'Professional Services', description: 'Business, management, strategy consulting' },
  { id: 'services-legal', name: 'Legal Services', category: 'Professional Services', description: 'Law firms, legal consulting' },
  { id: 'services-marketing', name: 'Marketing & Advertising', category: 'Professional Services', description: 'Digital marketing, advertising agencies' },
  { id: 'services-hr', name: 'Human Resources', category: 'Professional Services', description: 'HR consulting, recruitment' },
  { id: 'services-architecture', name: 'Architecture & Design', category: 'Professional Services', description: 'Architecture, interior design' },
  { id: 'services-engineering', name: 'Engineering', category: 'Professional Services', description: 'Civil, mechanical, electrical engineering' },

  // Education
  { id: 'education-k12', name: 'K-12 Education', category: 'Education', description: 'Primary and secondary education' },
  { id: 'education-higher', name: 'Higher Education', category: 'Education', description: 'Universities, colleges' },
  { id: 'education-online', name: 'Online Education', category: 'Education', description: 'E-learning platforms, online courses' },
  { id: 'education-training', name: 'Corporate Training', category: 'Education', description: 'Employee training, professional development' },

  // Media & Entertainment
  { id: 'media-publishing', name: 'Publishing', category: 'Media & Entertainment', description: 'Books, magazines, digital content' },
  { id: 'media-broadcasting', name: 'Broadcasting', category: 'Media & Entertainment', description: 'TV, radio, streaming' },
  { id: 'media-film', name: 'Film & Video', category: 'Media & Entertainment', description: 'Movie production, video content' },
  { id: 'media-music', name: 'Music', category: 'Media & Entertainment', description: 'Music production, recording, distribution' },
  { id: 'media-gaming', name: 'Gaming & Esports', category: 'Media & Entertainment', description: 'Video games, esports, gaming content' },

  // Transportation & Logistics
  { id: 'transport-logistics', name: 'Logistics & Supply Chain', category: 'Transportation', description: 'Shipping, warehousing, distribution' },
  { id: 'transport-delivery', name: 'Delivery Services', category: 'Transportation', description: 'Food delivery, package delivery' },
  { id: 'transport-ride-sharing', name: 'Ride Sharing', category: 'Transportation', description: 'Transportation platforms, mobility' },
  { id: 'transport-freight', name: 'Freight & Cargo', category: 'Transportation', description: 'Freight services, cargo transportation' },

  // Energy & Utilities
  { id: 'energy-renewable', name: 'Renewable Energy', category: 'Energy', description: 'Solar, wind, hydroelectric power' },
  { id: 'energy-oil-gas', name: 'Oil & Gas', category: 'Energy', description: 'Petroleum, natural gas, energy production' },
  { id: 'energy-utilities', name: 'Utilities', category: 'Energy', description: 'Electric, water, gas utilities' },
  { id: 'energy-storage', name: 'Energy Storage', category: 'Energy', description: 'Battery technology, energy storage solutions' },

  // Construction & Real Estate
  { id: 'construction-residential', name: 'Residential Construction', category: 'Construction', description: 'Home building, residential development' },
  { id: 'construction-commercial', name: 'Commercial Construction', category: 'Construction', description: 'Office buildings, commercial properties' },
  { id: 'construction-infrastructure', name: 'Infrastructure', category: 'Construction', description: 'Roads, bridges, public works' },
  { id: 'real-estate-development', name: 'Real Estate Development', category: 'Construction', description: 'Property development, land development' },

  // Agriculture & Food
  { id: 'agriculture-farming', name: 'Farming & Agriculture', category: 'Agriculture', description: 'Crop farming, livestock, agricultural products' },
  { id: 'agriculture-food-processing', name: 'Food Processing', category: 'Agriculture', description: 'Food manufacturing, processing' },
  { id: 'agriculture-agtech', name: 'AgTech', category: 'Agriculture', description: 'Agricultural technology, precision farming' },
  { id: 'agriculture-organic', name: 'Organic Farming', category: 'Agriculture', description: 'Organic agriculture, sustainable farming' },

  // Non-Profit & Government
  { id: 'nonprofit-charity', name: 'Charity & Non-Profit', category: 'Non-Profit', description: 'Charitable organizations, foundations' },
  { id: 'nonprofit-ngo', name: 'NGO', category: 'Non-Profit', description: 'Non-governmental organizations' },
  { id: 'government-federal', name: 'Federal Government', category: 'Government', description: 'Federal agencies, government services' },
  { id: 'government-state', name: 'State Government', category: 'Government', description: 'State agencies, local government' },
  { id: 'government-municipal', name: 'Municipal Government', category: 'Government', description: 'City government, local services' },

  // Other
  { id: 'other-startup', name: 'Startup', category: 'Other', description: 'Early-stage companies, innovation' },
  { id: 'other-freelance', name: 'Freelance/Independent', category: 'Other', description: 'Independent contractors, consultants' },
  { id: 'other-other', name: 'Other', category: 'Other', description: 'Other industries not listed' }
];

// Helper function to get industries by category
export function getIndustriesByCategory(category: string): Industry[] {
  return industries.filter(industry => industry.category === category);
}

// Helper function to get industry by ID
export function getIndustryById(id: string): Industry | undefined {
  return industries.find(industry => industry.id === id);
}

// Get unique categories
export function getIndustryCategories(): string[] {
  return [...new Set(industries.map(industry => industry.category))];
}

// Default industry (optional)
export const defaultIndustry = industries.find(i => i.id === 'other-startup')!; 