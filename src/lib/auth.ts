import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import { UserService } from './services/userService'
import { createDefaultServices } from './services/serviceManager'
import { defaultCountry } from '@/data/countries'
import bcrypt from 'bcryptjs'

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code"
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
          const userData = {
            email: user.email!,
            name: user.name!,
            role: 'user',
            userType: 'individual' as const,
            profilePicture: user.image || undefined,
            avatar: user.image || undefined,
            phone: '',
            industry: '',
            address: {
              street: '',
              city: '',
              country: defaultCountry.code,
              postalCode: ''
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
    async session({ session }) {
      if (session.user) {
        // Get full user data from database
        const dbUser = await UserService.getUserByEmail(session.user.email!)
        if (dbUser) {
          session.user.id = dbUser._id!.toString()
          session.user.name = dbUser.name
          session.user.email = dbUser.email
          session.user.image = dbUser.profilePicture || dbUser.avatar
          session.user.userType = dbUser.userType
          session.user.role = dbUser.role
          session.user.address = dbUser.address
          session.user.taxId = dbUser.taxId
          session.user.onboarding = dbUser.onboarding
          session.user.services = dbUser.services as unknown as Record<string, boolean>
        }
      }
      return session
    },
    async jwt({ token, user }) {
      if (user) {
        // Add custom user data to token
        token.userType = user.userType
        token.role = user.role
        token.onboarding = user.onboarding
        token.services = user.services
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