import "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name: string
      email: string
      image?: string
      userType: 'individual' | 'business'
      role: string
      address: {
        street: string
        city: string
        country: string
        postalCode: string
      }
      taxId?: string
      onboarding: {
        completed: boolean
        currentStep: number
        completedSteps: string[]
        serviceOnboarding: Record<string, unknown>
      }
      services: Record<string, boolean>
      organizationId?: string
    }
  }

  interface User {
    id: string
    name: string
    email: string
    image?: string
    userType: 'individual' | 'business'
    role: string
    address: {
      street: string
      city: string
      country: string
      postalCode: string
    }
    taxId?: string
    onboarding: {
      completed: boolean
      currentStep: number
      completedSteps: string[]
      serviceOnboarding: Record<string, unknown>
    }
    services: Record<string, boolean>
    organizationId?: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    googleId?: string
    mongoId?: string
    userType?: 'individual' | 'business'
    role?: string
    address?: {
      street: string
      city: string
      country: string
      postalCode: string
    }
    taxId?: string
    onboarding?: {
      completed: boolean
      currentStep: number
      completedSteps: string[]
      serviceOnboarding: Record<string, unknown>
    }
    services?: Record<string, boolean>
    organizationId?: string
  }
} 