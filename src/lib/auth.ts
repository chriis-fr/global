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
          console.log('❌ [Auth] Missing credentials')
          return null
        }

        try {
          console.log('🔐 [Auth] Attempting credentials login for:', credentials.email)
          
          // Get user from database
          const user = await UserService.getUserByEmail(credentials.email)
          if (!user) {
            console.log('❌ [Auth] User not found:', credentials.email)
            return null
          }

          // Check if user has a password (Google users might not have one)
          if (!user.password) {
            console.log('❌ [Auth] User has no password (Google account):', credentials.email)
            return null
          }

          // Verify password
          const isValidPassword = await bcrypt.compare(credentials.password, user.password)
          if (!isValidPassword) {
            console.log('❌ [Auth] Invalid password for user:', credentials.email)
            return null
          }

          console.log('✅ [Auth] Credentials login successful for:', credentials.email)
          
          // Update last login
          await UserService.updateUser(user._id!.toString(), {
            lastLoginAt: new Date()
          })

          return {
            id: user._id!.toString(),
            email: user.email,
            name: user.name,
            image: user.profilePicture || user.avatar,
            userType: user.userType,
            role: user.role,
            address: user.address,
            taxId: user.taxId,
            onboarding: user.onboarding,
            services: user.services as unknown as Record<string, boolean>
          }
        } catch (error) {
          console.error('❌ [Auth] Error during credentials login:', error)
          return null
        }
      }
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        try {
          console.log('🔐 [Auth] Google sign-in attempt for:', user.email)
          
          // Check if user already exists
          const existingUser = await UserService.getUserByEmail(user.email!)
          if (existingUser) {
            console.log('✅ [Auth] Existing user found, updating Google info')
            // Update existing user with Google info
            await UserService.updateUser(existingUser._id!.toString(), {
              profilePicture: user.image || undefined,
              avatar: user.image || undefined,
              lastLoginAt: new Date()
            })
            return true
          }

          // Create new user from Google data
          console.log('📝 [Auth] Creating new user from Google data')
          const googleUser = user as GoogleUserExtended
          console.log('🔍 [Auth] Google user data:', {
            email: googleUser.email,
            name: googleUser.name,
            given_name: googleUser.given_name,
            family_name: googleUser.family_name,
            locale: googleUser.locale,
            verified_email: googleUser.verified_email,
            hd: googleUser.hd
          })
          
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
            walletAddresses: [],
            settings: {
              currencyPreference: 'USD',
              notifications: {
                email: true,
                sms: false
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

          const newUser = await UserService.createUser(userData)
          console.log('✅ [Auth] New user created from Google:', newUser._id)
          return true
        } catch (error) {
          console.error('❌ [Auth] Error during Google sign-in:', error)
          return false
        }
      }
      return true
    },
    async session({ session, token }) {
      if (session.user) {
        // Use token data to avoid database calls
        session.user.id = token.sub!
        session.user.name = token.name as string
        session.user.email = token.email as string
        session.user.image = token.picture as string
        session.user.userType = token.userType as 'individual' | 'business'
        session.user.role = token.role as string
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
    async jwt({ token, user }) {
      if (user) {
        // Add custom user data to token
        token.userType = user.userType
        token.role = user.role
        token.address = user.address
        token.taxId = user.taxId
        token.onboarding = user.onboarding
        token.services = user.services || createDefaultServices()
        token.organizationId = user.organizationId
        
        console.log('🔐 [Auth] JWT token updated with services:', token.services)
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
  },
  secret: process.env.NEXTAUTH_SECRET,
} 