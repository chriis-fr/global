'use server'

import { UserService } from '@/lib/services/userService'
import { sendPasswordResetEmail } from '@/lib/services/emailService'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

interface PasswordResetResult {
  success: boolean
  message: string
  error?: string
}

/**
 * Request a password reset - generates token and sends email
 * Only sends email if user exists (for security)
 */
export async function requestPasswordReset(email: string): Promise<PasswordResetResult> {
  try {
    // Validate email
    if (!email || !email.trim()) {
      return {
        success: false,
        message: 'Email is required'
      }
    }

    // Check if user exists
    const user = await UserService.getUserByEmail(email.trim().toLowerCase())
    
    // For security, always return success message (don't reveal if email exists)
    // But only actually send email if user exists
    if (!user) {
      // Return success to prevent email enumeration
      return {
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      }
    }

    // Check if user has a password (OAuth users can't reset password this way)
    if (!user.password) {
      return {
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      }
    }

    // Check rate limiting - prevent abuse
    const now = new Date()
    if (user.passwordResetExpires && user.passwordResetExpires > now) {
      // Token already exists and hasn't expired - check if we should allow another request
      const timeSinceLastRequest = now.getTime() - (user.passwordResetExpires.getTime() - 3600000) // 1 hour ago
      if (timeSinceLastRequest < 300000) { // Less than 5 minutes since last request
        return {
          success: true,
          message: 'If an account with that email exists, a password reset link has been sent.'
        }
      }
    }

    // Generate secure random token (32 bytes = 256 bits)
    const resetToken = crypto.randomBytes(32).toString('hex')
    
    // Hash the token before storing (same security as passwords)
    const hashedToken = await bcrypt.hash(resetToken, 12)
    
    // Set expiration to 1 hour from now
    const expiresAt = new Date(now.getTime() + 3600000) // 1 hour

    // Store hashed token and expiration in database
    // Using MongoDB update directly since passwordResetToken fields aren't in UpdateUserInput
    const db = await import('@/lib/database').then(m => m.getDatabase())
    const usersCollection = db.collection('users')
    await usersCollection.updateOne(
      { _id: user._id },
      { 
        $set: { 
          passwordResetToken: hashedToken,
          passwordResetExpires: expiresAt,
          updatedAt: new Date()
        } 
      }
    )

    // Send reset email with the plain token (not hashed)
    const emailResult = await sendPasswordResetEmail(user.email, user.name || 'User', resetToken)

    if (!emailResult.success) {
      console.error('❌ [PasswordReset] Failed to send email:', emailResult.error)
      // Don't fail the request - token is still stored, user can request again
      return {
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      }
    }

    // DEBUG: Log the reset link for debugging purposes (remove when done)
    const frontendUrl = process.env.NODE_ENV === 'production' 
      ? (process.env.APP_URL || process.env.FRONTEND_URL || 'https://yourdomain.com')
      : 'http://localhost:3000'
    const resetLink = `${frontendUrl}/auth?resetToken=${resetToken}`
    console.log('✅ [PasswordReset] Reset token generated and email sent for:', user.email)
    console.log('🔗 [PasswordReset] DEBUG - Reset link:', resetLink)
    console.log('🔑 [PasswordReset] DEBUG - Reset token:', resetToken)
    
    return {
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.'
    }
  } catch (error) {
    console.error('❌ [PasswordReset] Error requesting password reset:', error)
    return {
      success: false,
      message: 'An error occurred. Please try again later.',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Verify a password reset token
 * Returns user ID if token is valid, null otherwise
 */
export async function verifyResetToken(token: string): Promise<{ valid: boolean; userId?: string; message?: string }> {
  try {
    if (!token || token.length !== 64) { // 32 bytes hex = 64 characters
      return {
        valid: false,
        message: 'Invalid reset token format'
      }
    }

    // Get all users with non-expired reset tokens
    // Note: We need to check all users since we can't query by hashed token
    // In production, you might want to add an index or use a separate collection
    const db = await import('@/lib/database').then(m => m.getDatabase())
    const usersCollection = db.collection('users')
    
    const now = new Date()
    const users = await usersCollection.find({
      passwordResetExpires: { $gt: now },
      passwordResetToken: { $exists: true, $ne: null }
    }).toArray()

    // Check each user's token
    for (const user of users) {
      if (user.passwordResetToken) {
        const isValid = await bcrypt.compare(token, user.passwordResetToken)
        if (isValid) {
          return {
            valid: true,
            userId: user._id.toString()
          }
        }
      }
    }

    return {
      valid: false,
      message: 'Invalid or expired reset token'
    }
  } catch (error) {
    console.error('❌ [PasswordReset] Error verifying token:', error)
    return {
      valid: false,
      message: 'An error occurred while verifying the token'
    }
  }
}

/**
 * Reset password with token
 * Validates token, updates password, and clears token
 */
export async function resetPasswordWithToken(
  token: string,
  newPassword: string
): Promise<PasswordResetResult> {
  try {
    // Validate inputs
    if (!token || token.length !== 64) {
      return {
        success: false,
        message: 'Invalid reset token format'
      }
    }

    if (!newPassword || newPassword.length < 8) {
      return {
        success: false,
        message: 'Password must be at least 8 characters long'
      }
    }

    // Verify token and get user
    const tokenVerification = await verifyResetToken(token)
    if (!tokenVerification.valid || !tokenVerification.userId) {
      return {
        success: false,
        message: tokenVerification.message || 'Invalid or expired reset token'
      }
    }

    // Get user to ensure they still exist
    const user = await UserService.getUserById(tokenVerification.userId)
    if (!user) {
      return {
        success: false,
        message: 'User not found'
      }
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 12)

    // Update password and clear reset token fields
    // Using MongoDB update directly since passwordResetToken fields aren't in UpdateUserInput
    const db = await import('@/lib/database').then(m => m.getDatabase())
    const usersCollection = db.collection('users')
    await usersCollection.updateOne(
      { _id: user._id },
      { 
        $set: { 
          password: hashedPassword,
          updatedAt: new Date()
        },
        $unset: {
          passwordResetToken: '',
          passwordResetExpires: ''
        }
      }
    )

    console.log('✅ [PasswordReset] Password reset successful for user:', user.email)

    return {
      success: true,
      message: 'Password has been reset successfully. You can now log in with your new password.'
    }
  } catch (error) {
    console.error('❌ [PasswordReset] Error resetting password:', error)
    return {
      success: false,
      message: 'An error occurred while resetting your password. Please try again.',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
