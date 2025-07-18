'use client'

import { useState } from 'react'
import Image from 'next/image'
import { User, Building } from 'lucide-react'

interface ProfileAvatarProps {
  src?: string | null
  alt: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  type?: 'user' | 'organization'
  className?: string
}

export function ProfileAvatar({ 
  src, 
  alt, 
  size = 'md', 
  type = 'user',
  className = '' 
}: ProfileAvatarProps) {
  const [imageError, setImageError] = useState(false)
  
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24'
  }
  
  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12'
  }

  const IconComponent = type === 'organization' ? Building : User

  if (src && !imageError) {
    return (
      <div className={`relative ${sizeClasses[size]} ${className}`}>
        <Image
          src={src}
          alt={alt}
          fill
          className="rounded-full object-cover"
          onError={() => setImageError(true)}
        />
      </div>
    )
  }

  return (
    <div className={`
      ${sizeClasses[size]} 
      ${className}
      rounded-full 
      bg-gradient-to-br from-blue-500 to-blue-600 
      flex items-center justify-center 
      text-white font-medium
      shadow-lg
    `}>
      <IconComponent className={iconSizes[size]} />
    </div>
  )
} 