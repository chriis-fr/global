import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-08-27.basil',
});

const STRIPE_PRODUCTS = {
  'receivables-free': 'prod_T6r1yjcct00js4',
  'receivables-pro': 'prod_T6iXtK73PnT58u',
  'payables-basic': 'prod_T6iaIHuMlk0ucf',
  'payables-pro': 'prod_T6ickesVybl87k',
  'combined-basic': 'prod_T6inEYX6geavuU',
  'combined-pro': 'prod_T6ip1LdL76B6Id',
};

async function getPriceIds() {
  console.log('Fetching price IDs for all products...\n');
  
  for (const [planId, productId] of Object.entries(STRIPE_PRODUCTS)) {
    try {
      const prices = await stripe.prices.list({
        product: productId,
        active: true,
      });

      console.log(`${planId} (${productId}):`);
      prices.data.forEach(price => {
        const interval = price.recurring?.interval;
        const amount = price.unit_amount ? (price.unit_amount / 100).toFixed(2) : '0.00';
        console.log(`  ${interval}: ${price.id} - $${amount}`);
      });
      console.log('');
    } catch (error) {
      console.error(`Error fetching prices for ${planId}:`, error);
    }
  }
}

getPriceIds().catch(console.error);
