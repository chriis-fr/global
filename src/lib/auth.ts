import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import { UserService } from './services/userService'
import { createDefaultServices } from './services/serviceManager'
import { getDatabase } from './database'
import { ObjectId } from 'mongodb'
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
        if (!credentials?.email || !credentials.password) {
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
            userType: ((user as unknown as Record<string, unknown>).userType as 'individual' | 'business') || 'individual',
            address: (() => {
              const a = (user as unknown as Record<string, unknown>).address as { street?: string; city?: string; country?: string; postalCode?: string } | undefined;
              return a && typeof a === 'object' ? { street: a.street ?? '', city: a.city ?? '', country: a.country ?? '', postalCode: a.postalCode ?? '' } : { street: '', city: '', country: '', postalCode: '' };
            })(),
            organizationId: user.organizationId?.toString(),
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
      if (account?.provider === 'google') {
        try {
          // Check if user already exists
          const existingUser = await UserService.getUserByEmail(user.email!)
          
          if (existingUser) {
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
              await activate30DayTrial(existingUser._id!.toString());
            }
            return true
          }

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

          await UserService.createUser(userData)
          return true
        } catch {
          return false
        }
      }
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
          } catch {
            // Error fetching user for JWT
          }
        }
      }
      
      // Only fetch latest user data if:
      // 1. Token doesn't have mongoId yet (first time)
      // 2. Explicitly triggered (e.g., session update)
      // 3. Token is older than 5 minutes (reduce DB calls by 95%)
      const shouldRefresh = !token.mongoId || 
                           trigger === 'update' || 
                           !token.lastRefresh ||
                           (token.lastRefresh && Date.now() - (token.lastRefresh as number) > 5 * 60 * 1000);
      
      if (token.email && shouldRefresh) {
        try {
          const dbUser = await UserService.getUserByEmail(token.email as string)
          if (dbUser) {
            token.organizationId = dbUser.organizationId?.toString()
            token.role = dbUser.role
            token.userType = ((dbUser as unknown as Record<string, unknown>).userType as 'individual' | 'business') || 'individual'
            const dbAddress = (dbUser as unknown as Record<string, unknown>).address as { street?: string; city?: string; country?: string; postalCode?: string } | undefined;
            token.address = dbAddress && typeof dbAddress === 'object' ? { street: dbAddress.street ?? '', city: dbAddress.city ?? '', country: dbAddress.country ?? '', postalCode: dbAddress.postalCode ?? '' } : token.address
            token.taxId = ((dbUser as unknown as Record<string, unknown>).taxId as string | undefined) ?? token.taxId
            // Mark as completed if isCompleted is true, data.completed is true, OR currentStep is 4 (final step)
            const isCompletedFlag = dbUser.onboarding?.isCompleted === true
            const dataCompleted = (dbUser.onboarding?.data as { completed?: boolean })?.completed
            const isCompleted = isCompletedFlag || dataCompleted === true || dbUser.onboarding?.currentStep === 4
            
            token.onboarding = {
              completed: isCompleted,
              currentStep: dbUser.onboarding?.currentStep || 0,
              completedSteps: dbUser.onboarding?.completedSteps || [],
              serviceOnboarding: dbUser.onboarding?.data || {}
            }
            // Org members: use organization's enabled services so sidebar and services match the org.
            // When org has none enabled (e.g. owner onboarded before we synced to org), sync from owner's user.services
            // so the whole organisation inherits the owner's services and all members see the same.
            if (dbUser.organizationId) {
              try {
                const db = await getDatabase()
                const orgId = typeof dbUser.organizationId === 'string'
                  ? new ObjectId(dbUser.organizationId)
                  : dbUser.organizationId
                const org = await db.collection('organizations').findOne({ _id: orgId })
                const orgServices = org?.services as Record<string, boolean> | undefined
                const hasAnyEnabled = orgServices && Object.values(orgServices).some(Boolean)
                let effectiveServices = hasAnyEnabled && orgServices
                  ? { ...createDefaultServices(), ...orgServices } as Record<string, boolean>
                  : (dbUser.services ? { ...createDefaultServices(), ...dbUser.services } : createDefaultServices()) as unknown as Record<string, boolean>

                // Sync from owner when org has no enabled services so members inherit owner's onboarding choices
                if (!hasAnyEnabled && org?.members?.length) {
                  const ownerMember = (org.members as Array<{ userId: { toString: () => string }; role: string }>).find(
                    (m) => m.role === 'owner'
                  )
                  if (ownerMember) {
                    const ownerUser = await UserService.getUserById(ownerMember.userId.toString())
                    const ownerServices = ownerUser?.services as Record<string, boolean> | undefined
                    const ownerHasAny = ownerServices && Object.values(ownerServices).some(Boolean)
                    if (ownerHasAny && ownerServices) {
                      effectiveServices = { ...createDefaultServices(), ...ownerServices } as Record<string, boolean>
                      try {
                        const { OrganizationService } = await import('./services/organizationService')
                        await OrganizationService.updateOrganization(dbUser.organizationId.toString(), {
                          services: effectiveServices
                        })
                      } catch {
                        // token already has effectiveServices; org sync best-effort
                      }
                    }
                  }
                }
                token.services = effectiveServices
              } catch (err) {
                console.error('[Services→Dashboard] JWT callback: org lookup failed, using user.services', { organizationId: dbUser.organizationId?.toString(), error: err })
                token.services = { ...(dbUser.services || createDefaultServices()) } as Record<string, boolean>
              }
            } else {
              token.services = { ...(dbUser.services || createDefaultServices()) } as Record<string, boolean>
            }
            token.mongoId = dbUser._id?.toString()
            token.adminTag = dbUser.adminTag || false
            token.lastRefresh = Date.now() // Track when we last refreshed
          }
        } catch {
          // Error fetching latest user data for JWT
        }
      }

      // Org members: when not doing full refresh, still refresh token.services and token.onboarding from DB
      // so dashboard sees completed onboarding and doesn't redirect back to onboarding (avoids flash loop).
      if (token.email && token.organizationId && !shouldRefresh) {
        try {
          const dbUser = await UserService.getUserByEmail(token.email as string)
          if (dbUser) {
            const isCompletedFlag = dbUser.onboarding?.isCompleted === true
            const dataCompleted = (dbUser.onboarding?.data as { completed?: boolean })?.completed
            const isCompleted = isCompletedFlag || dataCompleted === true || dbUser.onboarding?.currentStep === 4
            token.onboarding = {
              completed: isCompleted,
              currentStep: dbUser.onboarding?.currentStep || 0,
              completedSteps: dbUser.onboarding?.completedSteps || [],
              serviceOnboarding: dbUser.onboarding?.data || {}
            }
          }
          const db = await getDatabase()
          const orgId = typeof token.organizationId === 'string'
            ? new ObjectId(token.organizationId)
            : token.organizationId
          const org = await db.collection('organizations').findOne({ _id: orgId })
          const orgServices = org?.services as Record<string, boolean> | undefined
          const hasAnyEnabled = orgServices && Object.values(orgServices).some(Boolean)
          if (hasAnyEnabled && orgServices) {
            token.services = { ...createDefaultServices(), ...orgServices } as Record<string, boolean>
          }
        } catch {
          // non-blocking; keep existing token
        }
      }
      
      // Ensure onboarding and services are always set (even if empty/default)
      if (!token.onboarding) {
        token.onboarding = {
          completed: false,
          currentStep: 0,
          completedSteps: [],
          serviceOnboarding: {}
        };
      }
      
      if (!token.services) {
        token.services = createDefaultServices() as unknown as Record<string, boolean>;
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