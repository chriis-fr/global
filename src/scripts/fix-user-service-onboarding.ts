import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

async function fixUserServiceOnboarding() {
  try {
    const db = await connectToDatabase();
    
    // List all collections
    const collections = await db.listCollections().toArray();
    console.log('📊 Collections in database:', collections.map(c => c.name));
    
    const usersCollection = db.collection('users');

    // List all users first
    const allUsers = await usersCollection.find({}).toArray();
    console.log('📊 All users in database:', allUsers.map(u => ({
      _id: u._id,
      email: u.email,
      name: u.name
    })));

    // Find the specific user by email
    const user = await usersCollection.findOne({ 
      email: 'caspianodhis@gmail.com' 
    });

    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log('🔍 Found user:', {
      _id: user._id,
      email: user.email,
      name: user.name,
      onboarding: user.onboarding
    });

    // Check if serviceOnboarding exists and fix if needed
    const currentOnboarding = user.onboarding || {};
    const currentServiceOnboarding = currentOnboarding.serviceOnboarding || {};

    console.log('📊 Current service onboarding:', currentServiceOnboarding);

    // Initialize serviceOnboarding if it doesn't exist
    const updatedServiceOnboarding = {
      ...currentServiceOnboarding,
      smartInvoicing: {
        ...currentServiceOnboarding.smartInvoicing,
        status: 'pending',
        completed: false,
        businessInfo: {
          name: user.name || '',
          email: user.email || '',
          phone: user.phone || '',
          website: '',
          address: {
            street: user.address?.street || '',
            city: user.address?.city || '',
            state: user.address?.state || '',
            zipCode: user.address?.postalCode || '',
            country: user.address?.country || 'US'
          },
          taxId: user.taxId || '',
          logo: user.profilePicture || ''
        },
        invoiceSettings: {
          defaultCurrency: 'USD',
          paymentTerms: 30,
          taxRates: [
            {
              name: 'Standard Tax',
              rate: 0,
              description: 'Default tax rate'
            }
          ],
          invoiceTemplate: 'standard'
        }
      }
    };

    // Update the user's onboarding data
    const updateResult = await usersCollection.updateOne(
      { _id: user._id },
      {
        $set: {
          onboarding: {
            ...currentOnboarding,
            serviceOnboarding: updatedServiceOnboarding
          },
          updatedAt: new Date()
        }
      }
    );

    if (updateResult.modifiedCount > 0) {
      console.log('✅ User service onboarding data updated successfully');
      
      // Verify the update
      const updatedUser = await usersCollection.findOne({ _id: user._id });
      console.log('📋 Updated onboarding data:', {
        completed: updatedUser?.onboarding?.completed,
        currentStep: updatedUser?.onboarding?.currentStep,
        serviceOnboarding: updatedUser?.onboarding?.serviceOnboarding
      });
    } else {
      console.log('⚠️ No changes were made to the user data');
    }

  } catch (error) {
    console.error('❌ Error fixing user service onboarding:', error);
  } finally {
    process.exit(0);
  }
}

// Run the script
fixUserServiceOnboarding(); 