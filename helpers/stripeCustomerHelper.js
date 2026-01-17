import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const STRIPE_ACCOUNT_ID = process.env.STRIPE_ACCOUNT_ID || 'default';
const STRIPE_ENV = process.env.STRIPE_ENV || (process.env.STRIPE_SECRET_KEY?.startsWith('sk_live') ? 'live' : 'test');

/**
 * Get or create a valid Stripe customer for a user
 * Handles cases where customer ID is invalid or from different Stripe account
 */
export async function getOrCreateCustomer(user) {
  let customerId = user.stripeCustomerId;

  // Check if customer exists and is valid
  if (customerId) {
    try {
      // Validate customer exists in Stripe
      await stripe.customers.retrieve(customerId);
      console.log(`Valid customer found: ${customerId}`);
      return customerId;
    } catch (error) {
      if (error.code === 'resource_missing') {
        console.log(`Customer ${customerId} not found in Stripe. Recreating...`);
        customerId = null;
      } else {
        throw error;
      }
    }
  }

  // Create new customer
  console.log(`Creating new Stripe customer for user ${user.id}`);
  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name,
    metadata: {
      userId: user.id.toString(),
      environment: STRIPE_ENV,
      accountId: STRIPE_ACCOUNT_ID
    }
  });

  // Update database with new customer ID
  user.stripeCustomerId = customer.id;
  await user.save();

  console.log(`New customer created: ${customer.id}`);
  return customer.id;
}

/**
 * Validate customer before using in Stripe operations
 */
export async function validateCustomer(customerId) {
  try {
    await stripe.customers.retrieve(customerId);
    return true;
  } catch (error) {
    if (error.code === 'resource_missing') {
      return false;
    }
    throw error;
  }
}
