'use client'

import { useState, CSSProperties } from 'react'
import Image from 'next/image'
import { User, Building } from 'lucide-react'

interface ProfileAvatarProps {
  src?: string | null
  alt: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  type?: 'user' | 'organization'
  className?: string
  style?: CSSProperties
  highPriority?: boolean
}

export function ProfileAvatar({ 
  src, 
  alt, 
  size = 'md', 
  type = 'user',
  className = '',
  style,
  highPriority = false,
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

  const numericSize = {
    sm: 32,
    md: 48,
    lg: 64,
    xl: 96,
  }[size];

  if (src && !imageError) {
    return (
      <div
        className={`relative shrink-0 overflow-hidden rounded-full aspect-square ${sizeClasses[size]} ${className}`}
        style={{
          willChange: 'transform',
          transform: 'translateZ(0)',
          WebkitBackfaceVisibility: 'hidden',
          backfaceVisibility: 'hidden',
          ...style,
        }}
      >
        <Image
          src={src}
          alt={alt}
          fill
          sizes={`${numericSize}px`}
          className="object-cover"
          onError={() => setImageError(true)}
          priority={highPriority}
          draggable={false}
        />
      </div>
    )
  }

  return (
    <div
      className={`
      ${sizeClasses[size]} 
      ${className}
      rounded-full 
      bg-gradient-to-br from-blue-500 to-blue-600 
      flex items-center justify-center 
      text-white font-medium
      shadow-lg
      `}
      style={{
        willChange: 'transform',
        transform: 'translateZ(0)',
        WebkitBackfaceVisibility: 'hidden',
        backfaceVisibility: 'hidden',
        ...style,
      }}
    >
      <IconComponent className={iconSizes[size]} />
    </div>
  )
} 