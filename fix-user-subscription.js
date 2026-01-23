// Quick fix script to activate user subscription
// Run: node fix-user-subscription.js

import User from './models/userModel.js';
import { sequelize } from './config/db.js';

async function fixUserSubscription() {
  try {
    await sequelize.authenticate();
    console.log('Database connected');

    // Find user with this subscription ID
    const user = await User.findOne({
      where: sequelize.literal(`JSON_EXTRACT(subscription, '$.id') = 'sub_1SsS2zGL4EiShnQM3XTLEhx0'`)
    });

    if (!user) {
      console.log('User not found');
      process.exit(1);
    }

    console.log('Found user:', user.email);
    console.log('Current subscription:', user.subscription);

    // Fix subscription
    user.subscription = {
      ...user.subscription,
      status: 'active',
      cancelAtPeriodEnd: false,
    };

    await user.save();
    console.log('✅ Subscription fixed!');
    console.log('New subscription:', user.subscription);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixUserSubscription();
