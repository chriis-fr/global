import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import { UserService } from './services/userService'
import { createDefaultServices } from './services/serviceManager'
import { defaultCountry } from '@/data/countries'
import bcrypt from 'bcryptjs'

// Extended Google user interface with additional fields
interface GoogleUserExtended {
  email: string
  name: string
  image?: string
  given_name?: string
  family_name?: string
  locale?: string
  verified_email?: boolean
  hd?: string
  phoneNumbers?: Array<{ value: string; type?: string }>
  addresses?: Array<{
    streetAddress?: string
    locality?: string
    country?: string
    postalCode?: string
  }>
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
          scope: [
            "https://www.googleapis.com/auth/userinfo.profile",
            "https://www.googleapis.com/auth/userinfo.email"
          ].join(" ")
        }
      }
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        try {
          
          // Get user from database
          const user = await UserService.getUserByEmail(credentials.email)
          if (!user) {
            return null
          }

          // Check if user has a password (Google users might not have one)
          if (!user.password) {
            return null
          }

          // Verify password
          const isValidPassword = await bcrypt.compare(credentials.password, user.password)
          if (!isValidPassword) {
            return null
          }
          
          // Update last login
          await UserService.updateUser(user._id!.toString(), {
            lastLoginAt: new Date()
          })

          return {
            id: user._id!.toString(),
            email: user.email,
            name: user.name,
            image: user.avatar,
            role: user.role,
            userType: 'individual', // Default value since property doesn't exist on User model
            address: {
              street: '',
              city: '',
              country: '',
              postalCode: ''
            }, // Default empty address object since property doesn't exist on User model
            onboarding: {
              completed: user.onboarding?.isCompleted || false,
              currentStep: user.onboarding?.currentStep || 0,
              completedSteps: user.onboarding?.completedSteps || [],
              serviceOnboarding: user.onboarding?.data || {}
            },
            services: user.services as unknown as Record<string, boolean>
          }
        } catch {
          return null
        }
      }
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      console.log('🔍 [Auth] SignIn callback triggered')
      console.log('🔍 [Auth] User:', user)
      console.log('🔍 [Auth] Account:', account)
      
      if (account?.provider === 'google') {
        console.log('🔍 [Auth] Google provider detected')
        try {
          console.log('🔍 [Auth] Checking if user exists:', user.email)
          
          // Check if user already exists
          const existingUser = await UserService.getUserByEmail(user.email!)
          console.log('🔍 [Auth] Existing user check result:', existingUser ? 'Found' : 'Not found')
          
          if (existingUser) {
            console.log('🔍 [Auth] Updating existing user')
            // Update existing user with Google info
            await UserService.updateUser(existingUser._id!.toString(), {
              profilePicture: user.image || undefined,
              avatar: user.image || undefined,
              lastLoginAt: new Date()
            })
            
            // Check if existing user should get 30-day trial
            const { activate30DayTrial } = await import('@/lib/actions/subscription');
            const hasProSubscription = existingUser.subscription && existingUser.subscription.planId !== 'receivables-free' && existingUser.subscription.status === 'active';
            const hasUsedTrial = existingUser.subscription?.hasUsedTrial;
            
            if (!hasProSubscription && !hasUsedTrial) {
              console.log('🎉 [Auth] Existing user eligible for 30-day trial, activating...');
              await activate30DayTrial(existingUser._id!.toString());
            }
            
            console.log('✅ [Auth] Existing user updated successfully')
            return true
          }

          console.log('🔍 [Auth] Creating new user from Google data')
          // Create new user from Google data
          const googleUser = user as GoogleUserExtended
          
          const userData = {
            email: googleUser.email!,
            name: googleUser.name!,
            role: 'user',
            userType: 'individual' as const,
            profilePicture: googleUser.image || undefined,
            avatar: googleUser.image || undefined,
            phone: googleUser.phoneNumbers?.[0]?.value || '',
            industry: '',
            address: {
              street: googleUser.addresses?.[0]?.streetAddress || '',
              city: googleUser.addresses?.[0]?.locality || '',
              country: googleUser.addresses?.[0]?.country || defaultCountry.code,
              postalCode: googleUser.addresses?.[0]?.postalCode || ''
            },
            taxId: '',
            termsAgreement: {
              agreed: true,
              agreedAt: new Date(),
              termsVersion: '1.0'
            },
            walletAddresses: [],
            settings: {
              currencyPreference: 'USD',
              notifications: {
                email: true,
                sms: false,
                push: false,
                inApp: true,
                invoiceCreated: true,
                invoicePaid: true,
                invoiceOverdue: true,
                paymentReceived: true,
                paymentFailed: true,
                systemUpdates: true,
                securityAlerts: true,
                reminders: true,
                approvals: true,
                frequency: 'immediate' as const,
                quietHours: {
                  enabled: false,
                  start: '22:00',
                  end: '08:00',
                  timezone: 'UTC'
                }
              }
            },
            services: createDefaultServices(),
            onboarding: {
              completed: false,
              currentStep: 1,
              completedSteps: ['google-signup'],
              serviceOnboarding: {}
            }
          }

          console.log('🔍 [Auth] User data prepared:', { email: userData.email, name: userData.name })
          await UserService.createUser(userData)
          console.log('✅ [Auth] New user created successfully')
          return true
        } catch (error) {
          console.error('❌ [Auth] Error during Google sign-in:', error)
          console.error('❌ [Auth] Error details:', {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            name: error instanceof Error ? error.name : 'Unknown'
          })
          return false
        }
      }
      console.log('🔍 [Auth] Non-Google provider, returning true')
      return true
    },
    async session({ session, token }) {
      if (session.user) {
        // Use MongoDB ObjectId if available, otherwise fall back to JWT subject
        session.user.id = (token.mongoId as string) || token.sub!
        session.user.name = token.name as string
        session.user.email = token.email as string
        session.user.image = token.picture as string
        session.user.userType = token.userType as 'individual' | 'business'
        session.user.role = token.role as string
        session.user.adminTag = (token.adminTag as boolean) || false
        session.user.address = token.address as {
          street: string
          city: string
          country: string
          postalCode: string
        }
        session.user.taxId = token.taxId as string
        session.user.onboarding = token.onboarding as {
          completed: boolean
          currentStep: number
          completedSteps: string[]
          serviceOnboarding: Record<string, unknown>
        }
        session.user.services = (token.services as Record<string, boolean>) || createDefaultServices()
        session.user.organizationId = token.organizationId as string
      }
      return session
    },
    async jwt({ token, user, trigger }) {
      if (user) {
        // Add custom user data to token
        token.userType = user.userType
        token.role = user.role
        token.address = user.address
        token.taxId = user.taxId
        token.onboarding = user.onboarding
        token.services = user.services || createDefaultServices()
        token.organizationId = user.organizationId
        
        // For OAuth users, we need to get the MongoDB ObjectId from the database
        if (user.email && !token.mongoId) {
          try {
            const dbUser = await UserService.getUserByEmail(user.email)
            if (dbUser?._id) {
              token.mongoId = dbUser._id.toString()
            }
          } catch (error) {
            console.error('❌ [Auth] Error fetching user for JWT:', error)
          }
        }
      }
      
      // Only fetch latest user data if:
      // 1. Token doesn't have mongoId yet (first time)
      // 2. Explicitly triggered (e.g., session update)
      // 3. Token is older than 5 minutes (reduce DB calls by 95%)
      const shouldRefresh = !token.mongoId || 
                           trigger === 'update' || 
                           (token.lastRefresh && Date.now() - (token.lastRefresh as number) > 5 * 60 * 1000);
      
      if (token.email && shouldRefresh) {
        try {
          const dbUser = await UserService.getUserByEmail(token.email as string)
          if (dbUser) {
            token.organizationId = dbUser.organizationId?.toString()
            token.role = dbUser.role
            // Mark as completed if isCompleted is true OR if currentStep is 4 (final step)
            const isCompleted = dbUser.onboarding?.isCompleted || dbUser.onboarding?.currentStep === 4
            token.onboarding = {
              completed: isCompleted,
              currentStep: dbUser.onboarding?.currentStep || 0,
              completedSteps: dbUser.onboarding?.completedSteps || [],
              serviceOnboarding: dbUser.onboarding?.data || {}
            }
            token.services = { ...(dbUser.services || createDefaultServices()) } as Record<string, boolean>
            token.mongoId = dbUser._id?.toString()
            token.adminTag = dbUser.adminTag || false
            token.lastRefresh = Date.now() // Track when we last refreshed
          }
        } catch {
          // Error fetching latest user data for JWT
        }
      }
      
      return token
    }
  },
  pages: {
    signIn: '/auth',
    error: '/auth',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days - longer session to reduce re-auth
  },
  secret: process.env.NEXTAUTH_SECRET,
} 