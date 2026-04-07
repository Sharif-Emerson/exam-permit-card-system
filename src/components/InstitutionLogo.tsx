import { useEffect, useState } from 'react'
import { institutionLogo as defaultLogo, institutionName } from '../config/branding'

type InstitutionLogoProps = {
  src?: string | null
  alt?: string
  className?: string
  fallbackClassName?: string
  draggable?: boolean
}

function getInstitutionInitials(name: string) {
  const acronymMatch = name.match(/\(([^)]+)\)/)
  if (acronymMatch?.[1]) {
    return acronymMatch[1].trim().slice(0, 4).toUpperCase()
  }

  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 4)
    .toUpperCase()
}

export default function InstitutionLogo({
  src,
  alt = `${institutionName} logo`,
  className = '',
  fallbackClassName,
  draggable = false,
}: InstitutionLogoProps) {
  const resolvedSrc = src?.trim() || defaultLogo
  const [showFallback, setShowFallback] = useState(!resolvedSrc)

  useEffect(() => {
    setShowFallback(!resolvedSrc)
  }, [resolvedSrc])

  if (showFallback) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={fallbackClassName ?? `${className} flex items-center justify-center bg-emerald-700 font-black tracking-[0.18em] text-white`}
      >
        {getInstitutionInitials(institutionName)}
      </div>
    )
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      className={className}
      draggable={draggable}
      onError={() => setShowFallback(true)}
    />
  )
}