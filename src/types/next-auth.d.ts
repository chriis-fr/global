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
      onboarding: {
        completed: boolean
        currentStep: number
        completedSteps: string[]
        serviceOnboarding: Record<string, unknown>
      }
      services: Record<string, boolean>
    }
  }

  interface User {
    id: string
    name: string
    email: string
    image?: string
    userType: 'individual' | 'business'
    role: string
    googleId?: string
    onboarding: {
      completed: boolean
      currentStep: number
      completedSteps: string[]
      serviceOnboarding: Record<string, unknown>
    }
    services: Record<string, boolean>
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    googleId?: string
    userType?: 'individual' | 'business'
    role?: string
    onboarding?: {
      completed: boolean
      currentStep: number
      completedSteps: string[]
      serviceOnboarding: Record<string, unknown>
    }
    services?: Record<string, boolean>
  }
} 